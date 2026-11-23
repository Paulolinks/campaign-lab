import { NextResponse } from "next/server";
import { z } from "zod";
import { agentKeyOf } from "@/lib/agent-export";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

/** The analyst may only move a plan between draft, ready and archived. Testing/paused stay with the owner. */
const body = z.object({ status: z.enum(["DRAFT", "READY", "ARCHIVED"]) });

/**
 * POST /api/agent/v1/brands/{brandId}/campaigns/{campaignId}/status  { status }
 * Lets the analyst (Claude) tidy the plans list, e.g. archive an old idea. Reversible and audited
 * as done by the owner who created the key. Nothing changes on Meta.
 */
export async function POST(request: Request, { params }: { params: Promise<{ brandId: string; campaignId: string }> }) {
  const key = await agentKeyOf(request);
  if (!key) return NextResponse.json({ error: "Chave inválida ou revogada." }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Envie { status: DRAFT | READY | ARCHIVED }." }, { status: 400 });

  const { brandId, campaignId } = await params;
  const campaign = await db().campaignPlan.findFirst({ where: { id: campaignId, brandId, brand: { workspaceId: key.workspaceId } } });
  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });

  const status = parsed.data.status;
  await db().campaignPlan.update({ where: { id: campaign.id }, data: { status } });
  await audit({
    workspaceId: key.workspaceId,
    userId: key.createdById,
    brandId,
    action: "campaign.status_changed",
    entity: "CampaignPlan",
    entityId: campaign.id,
    data: { from: campaign.status, to: status, by: "agent" },
  });
  return NextResponse.json({ id: campaign.id, campaignKey: campaign.campaignKey, from: campaign.status, to: status });
}
