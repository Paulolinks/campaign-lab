import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { sniffFileType } from "@/domain/file-signature";
import { audit } from "@/lib/audit";
import { getAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { maxUploadBytes, uploadTarget } from "@/providers/storage";

/**
 * Upload: POST /api/media?brandId=...&variantId=... with the raw file as the body and its name in `x-file-name`.
 * Streams to storage (no full buffering), checks the real type from the first bytes, saves metadata.
 */
export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const member = await db().workspaceMember.findFirst({ where: { userId: session.user.id } });
  if (!member || !["OWNER", "EDITOR"].includes(member.role)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const url = new URL(request.url);
  const brandId = url.searchParams.get("brandId") ?? "";
  const variantId = url.searchParams.get("variantId");
  const brand = await db().brand.findFirst({ where: { id: brandId, workspaceId: member.workspaceId } });
  if (!brand) return NextResponse.json({ error: "Marca não encontrada." }, { status: 404 });
  if (variantId) {
    const variant = await db().adVariant.findFirst({ where: { id: variantId, brandId } });
    if (!variant) return NextResponse.json({ error: "Anúncio não encontrado." }, { status: 404 });
  }

  const maxBytes = maxUploadBytes();
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return NextResponse.json({ error: `Arquivo maior que ${Math.round(maxBytes / 1048576)} MB.` }, { status: 413 });
  if (!request.body) return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
  const fileName = decodeURIComponent(request.headers.get("x-file-name") ?? "arquivo").slice(0, 200);

  // Read the first chunk(s) to detect the type, then put them back in front of the rest of the stream.
  const reader = request.body.getReader();
  const head: Uint8Array[] = [];
  let headLength = 0;
  while (headLength < 16) {
    const { value, done } = await reader.read();
    if (done) break;
    head.push(value);
    headLength += value.length;
  }
  const headBytes = concat(head);
  const type = sniffFileType(headBytes);
  if (!type) {
    await reader.cancel();
    return NextResponse.json({ error: "Tipo de arquivo não aceito. Use MP4, MOV, WEBM, JPG, PNG, WEBP, GIF ou PDF." }, { status: 415 });
  }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(headBytes);
    },
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  const storage = uploadTarget();
  let stored;
  try {
    stored = await storage.put({ brandId, fileName, body, maxBytes });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao salvar." }, { status: 400 });
  }

  const asset = await db().mediaAsset.create({
    data: {
      brandId,
      variantId,
      kind: type.kind,
      fileName,
      mimeType: type.mimeType,
      bytes: BigInt(stored.bytes),
      sha256: stored.sha256,
      storageProvider: storage.id,
      storageKey: stored.key,
      uploadStatus: "STORED",
      createdBy: session.user.id,
    },
  });
  await audit({ workspaceId: member.workspaceId, userId: session.user.id, brandId, action: "media.uploaded", entity: "MediaAsset", entityId: asset.id, data: { fileName, bytes: stored.bytes, variantId } });
  return NextResponse.json({ id: asset.id, kind: asset.kind, bytes: stored.bytes });
}

function concat(chunks: Uint8Array[]) {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
