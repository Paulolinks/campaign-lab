import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_IMPORT_BYTES } from "@/domain/cscamp-parser";
import { agentKeyOf } from "@/lib/agent-export";
import { db } from "@/lib/db";
import { commitImport, planImport } from "@/lib/import-service";

const body = z.object({
  fileName: z.string().trim().min(1).max(200).default("claude.txt"),
  text: z.string().min(1).max(MAX_IMPORT_BYTES),
  dryRun: z.boolean().default(false),
});

/**
 * POST /api/agent/v1/brands/{brandId}/import  { fileName, text (CSCAMP/1), dryRun }
 * Lets the analyst (Claude) save campaign plans as DRAFTS, exactly like Importar in the app (spec 05).
 * Nothing is published or changed on Meta. Logged as done by the owner who created the key.
 */
export async function POST(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const key = await agentKeyOf(request);
  if (!key) return NextResponse.json({ error: "Chave inválida ou revogada." }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Envie { fileName, text, dryRun }." }, { status: 400 });

  const { brandId } = await params;
  const [brand, owner] = await Promise.all([
    db().brand.findFirst({ where: { id: brandId, workspaceId: key.workspaceId }, select: { id: true } }),
    db().workspaceMember.findFirst({ where: { workspaceId: key.workspaceId, userId: key.createdById, role: "OWNER" }, include: { user: true } }),
  ]);
  if (!brand) return NextResponse.json({ error: "Marca não encontrada." }, { status: 404 });
  if (!owner) return NextResponse.json({ error: "Quem criou a chave não é mais dono do espaço." }, { status: 403 });

  const { fileName, text, dryRun } = parsed.data;
  if (dryRun) return NextResponse.json({ plan: await planImport(brand.id, text) });
  const user = { id: owner.userId, name: owner.user.name, email: owner.user.email, workspaceId: key.workspaceId, role: owner.role };
  const result = await commitImport(user, brand.id, `[Claude] ${fileName}`, text);
  return NextResponse.json(result, { status: "errors" in result ? 422 : 201 });
}
