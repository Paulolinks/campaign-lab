"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildUtmUrl, utmSourceMedium } from "@/domain/utm";
import type { ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireEditor } from "@/lib/session";

const statusSchema = z.enum(["DRAFT", "READY", "TESTING", "PAUSED", "ARCHIVED"]);
const testLabelSchema = z.enum(["", "TESTING", "INSUFFICIENT_DATA", "BEST_QUALITY_PROVISIONAL", "PAUSED", "ARCHIVED"]);

export async function updateCampaignStatus(campaignId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const user = await requireEditor();
  const campaign = await db().campaignPlan.findFirst({ where: { id: campaignId, brand: { workspaceId: user.workspaceId } } });
  if (!campaign) return { error: "Campanha não encontrada." };
  const status = statusSchema.safeParse(data.get("status"));
  if (!status.success) return { error: "Status inválido." };
  await db().campaignPlan.update({ where: { id: campaignId }, data: { status: status.data } });
  await audit({ workspaceId: user.workspaceId, userId: user.id, brandId: campaign.brandId, action: "campaign.status_changed", entity: "CampaignPlan", entityId: campaignId, data: { from: campaign.status, to: status.data } });
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: "Status atualizado." };
}

export async function updateVariantStatus(variantId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const user = await requireEditor();
  const variant = await db().adVariant.findFirst({ where: { id: variantId, brand: { workspaceId: user.workspaceId } } });
  if (!variant) return { error: "Anúncio não encontrado." };
  const status = statusSchema.safeParse(data.get("status"));
  const label = testLabelSchema.safeParse(data.get("testLabel") ?? "");
  if (!status.success || !label.success) return { error: "Valor inválido." };
  const testLabel = label.data || null;
  await db().adVariant.update({ where: { id: variantId }, data: { status: status.data, testLabel } });
  await audit({
    workspaceId: user.workspaceId, userId: user.id, brandId: variant.brandId, action: "variant.status_changed", entity: "AdVariant", entityId: variantId,
    data: { from: { status: variant.status, testLabel: variant.testLabel }, to: { status: status.data, testLabel } },
  });
  revalidatePath(`/variants/${variantId}`);
  return { ok: "Status atualizado." };
}

/** Changes the campaign landing URL (e.g. replacing a {{TEMPLATE}} from the import). Re-generates UTM links. */
export async function updateCampaignLanding(campaignId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const user = await requireEditor();
  const campaign = await db().campaignPlan.findFirst({ where: { id: campaignId, brand: { workspaceId: user.workspaceId } } });
  if (!campaign) return { error: "Campanha não encontrada." };
  const url = z.url({ protocol: /^https?$/, error: "Use uma URL completa (https://...)." }).safeParse(String(data.get("landingUrl") ?? "").trim());
  if (!url.success) return { error: url.error.issues[0].message };
  await db().campaignPlan.update({ where: { id: campaignId }, data: { landingUrl: url.data } });

  // Published ads of this campaign get their UTM link rebuilt from the new URL.
  const ads = await db().publishedAd.findMany({ where: { variant: { campaignId } }, include: { variant: true } });
  for (const ad of ads) {
    const utmUrl = buildUtmUrl(url.data, { ...utmSourceMedium(ad.platform), campaign: campaign.campaignKey, content: ad.variant!.adKey });
    await db().publishedAd.update({ where: { id: ad.id }, data: { utmUrl } });
  }
  await audit({ workspaceId: user.workspaceId, userId: user.id, brandId: campaign.brandId, action: "campaign.landing_changed", entity: "CampaignPlan", entityId: campaignId, data: { from: campaign.landingUrl, to: url.data } });
  revalidatePath("/", "layout");
  return { ok: "Landing page salva." };
}

/** Checks or unchecks one owner task of the campaign plan (by its text, so a re-import keeps what was done). */
export async function toggleCampaignTask(campaignId: string, task: string, done: boolean): Promise<ActionState> {
  const user = await requireEditor();
  const campaign = await db().campaignPlan.findFirst({ where: { id: campaignId, brand: { workspaceId: user.workspaceId } } });
  if (!campaign) return { error: "Campanha não encontrada." };
  const text = task.trim().slice(0, 500);
  const tasksDone = done ? [...new Set([...campaign.tasksDone, text])] : campaign.tasksDone.filter((t) => t !== text);
  await db().campaignPlan.update({ where: { id: campaignId }, data: { tasksDone } });
  await audit({ workspaceId: user.workspaceId, userId: user.id, brandId: campaign.brandId, action: done ? "campaign.task_done" : "campaign.task_reopened", entity: "CampaignPlan", entityId: campaignId, data: { task: text } });
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: done ? "Feito." : "Reaberto." };
}
