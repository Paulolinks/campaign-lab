import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { storageFor } from "@/providers/storage";

async function findAsset(id: string) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  const member = await db().workspaceMember.findFirst({ where: { userId: session.user.id } });
  if (!member) return { error: NextResponse.json({ error: "Sem permissão." }, { status: 403 }) };
  const asset = await db().mediaAsset.findFirst({ where: { id, brand: { workspaceId: member.workspaceId } } });
  if (!asset) return { error: NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 }) };
  return { asset, member, userId: session.user.id };
}

/** Streams a private file to a logged-in member. Supports Range so videos can seek. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await findAsset((await params).id);
  if ("error" in found) return found.error;
  const { asset } = found;
  if (asset.storageProvider !== "LOCAL") return NextResponse.json({ error: "Arquivo está no Google Drive (ainda não suportado)." }, { status: 501 });

  const storage = storageFor("LOCAL");
  const size = await storage.size(asset.storageKey).catch(() => null);
  if (size === null) return NextResponse.json({ error: "Arquivo não encontrado no servidor." }, { status: 404 });

  const base = {
    "Content-Type": asset.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new Response(storage.read(asset.storageKey, { start, end }), {
      status: 206,
      headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(storage.read(asset.storageKey), { headers: { ...base, "Content-Length": String(size) } });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const found = await findAsset((await params).id);
  if ("error" in found) return found.error;
  const { asset, member, userId } = found;
  if (!["OWNER", "EDITOR"].includes(member.role)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  await db().mediaAsset.delete({ where: { id: asset.id } });
  if (asset.storageProvider === "LOCAL") await storageFor("LOCAL").remove(asset.storageKey);
  await audit({ workspaceId: member.workspaceId, userId, brandId: asset.brandId, action: "media.deleted", entity: "MediaAsset", entityId: asset.id, data: { fileName: asset.fileName } });
  return NextResponse.json({ ok: true });
}
