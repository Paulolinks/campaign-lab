import { NextResponse } from "next/server";
import { exportBrandForAgent, workspaceForAgent } from "@/lib/agent-export";

/**
 * GET /api/agent/v1/brands/{brandId}/export?since=YYYY-MM-DD&actions=1
 * Everything the analyst needs about one brand, read-only and without lead PII (spec 05).
 */
export async function GET(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const workspaceId = await workspaceForAgent(request);
  if (!workspaceId) return NextResponse.json({ error: "Chave inválida ou revogada." }, { status: 401 });
  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get("since");
  if (sinceRaw && !/^\d{4}-\d{2}-\d{2}$/.test(sinceRaw)) return NextResponse.json({ error: "since deve ser AAAA-MM-DD." }, { status: 400 });
  const data = await exportBrandForAgent(workspaceId, (await params).brandId, {
    since: sinceRaw ? new Date(`${sinceRaw}T00:00:00Z`) : null,
    withActions: url.searchParams.get("actions") === "1",
  });
  if (!data) return NextResponse.json({ error: "Marca não encontrada." }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
