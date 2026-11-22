import { NextResponse } from "next/server";
import { listBrandsForAgent, workspaceForAgent } from "@/lib/agent-export";

/** GET /api/agent/v1/brands, read-only, for the analyst key created in Integrações (spec 05). */
export async function GET(request: Request) {
  const workspaceId = await workspaceForAgent(request);
  if (!workspaceId) return NextResponse.json({ error: "Chave inválida ou revogada." }, { status: 401 });
  return NextResponse.json({ brands: await listBrandsForAgent(workspaceId) }, { headers: { "Cache-Control": "no-store" } });
}
