"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildUtmUrl, utmSourceMedium } from "@/domain/utm";
import { loadAdResults } from "@/lib/ad-results-service";
import type { ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getBrandContext, requireEditor } from "@/lib/session";

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null);

const publishedSchema = z.object({
  platform: z.enum(["META", "FACEBOOK_ORGANIC", "INSTAGRAM_ORGANIC", "GOOGLE_ADS", "GOOGLE_BUSINESS_PROFILE", "TIKTOK", "YOUTUBE", "NEXTDOOR", "MARKETPLACE", "WEBSITE", "OTHER"]),
  externalAdId: z.string().trim().min(1, "Informe o ID do anúncio na plataforma.").max(120),
  externalCampaignId: text(120),
  externalAdSetId: text(120),
  name: text(300),
  placement: text(120),
  externalStatus: text(60),
  url: text(1000),
  variantId: text(64),
  channelAccountId: text(64),
  publishedAt: z.string().trim().transform((v) => (v ? new Date(`${v}T12:00:00Z`) : null)),
  notes: text(2000),
});

const FIELDS = ["platform", "externalAdId", "externalCampaignId", "externalAdSetId", "name", "placement", "externalStatus", "url", "variantId", "channelAccountId", "publishedAt", "notes"];

/**
 * Registers a real ad (e.g. a Meta ad ID) and links it to an internal variant.
 * The external ID is the attribution key; matching never happens by headline.
 */
export async function savePublishedAd(_: ActionState, data: FormData): Promise<ActionState> {
  const user = await requireEditor();
  const { brand } = await getBrandContext(user);
  if (!brand) return { error: "Crie uma marca primeiro." };
  const parsed = publishedSchema.safeParse(Object.fromEntries(FIELDS.map((k) => [k, data.get(k) ?? ""])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const p = parsed.data;

  let utmUrl: string | null = null;
  if (p.variantId) {
    const variant = await db().adVariant.findFirst({ where: { id: p.variantId, brandId: brand.id }, include: { campaign: true } });
    if (!variant) return { error: "Anúncio interno não encontrado nesta marca." };
    utmUrl = buildUtmUrl(variant.campaign.landingUrl, { ...utmSourceMedium(p.platform), campaign: variant.campaign.campaignKey, content: variant.adKey });
  }
  if (p.channelAccountId) {
    const ch = await db().channelAccount.findFirst({ where: { id: p.channelAccountId, brandId: brand.id } });
    if (!ch) return { error: "Conta não encontrada nesta marca." };
  }

  const existing = await db().publishedAd.findUnique({ where: { brandId_platform_externalAdId: { brandId: brand.id, platform: p.platform, externalAdId: p.externalAdId } } });
  const saved = await db().publishedAd.upsert({
    where: { brandId_platform_externalAdId: { brandId: brand.id, platform: p.platform, externalAdId: p.externalAdId } },
    create: { ...p, brandId: brand.id, utmUrl },
    update: { ...p, utmUrl },
  });
  await audit({
    workspaceId: user.workspaceId, userId: user.id, brandId: brand.id,
    action: existing ? "published_ad.updated" : "published_ad.created", entity: "PublishedAd", entityId: saved.id,
    data: { externalAdId: p.externalAdId, variantFrom: existing?.variantId ?? null, variantTo: p.variantId },
  });
  revalidatePath("/", "layout");
  return { ok: existing ? "Publicação atualizada." : "Publicação vinculada." };
}

/** Re-links (or unlinks) a published ad to a variant. Logged in the audit trail. */
export async function linkPublishedAd(publishedAdId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const user = await requireEditor();
  const ad = await db().publishedAd.findFirst({ where: { id: publishedAdId, brand: { workspaceId: user.workspaceId } } });
  if (!ad) return { error: "Publicação não encontrada." };
  const variantId = String(data.get("variantId") ?? "") || null;
  if (variantId && !(await db().adVariant.findFirst({ where: { id: variantId, brandId: ad.brandId } }))) return { error: "Anúncio interno inválido." };
  await db().publishedAd.update({ where: { id: ad.id }, data: { variantId } });
  await audit({ workspaceId: user.workspaceId, userId: user.id, brandId: ad.brandId, action: "published_ad.linked", entity: "PublishedAd", entityId: ad.id, data: { from: ad.variantId, to: variantId } });
  revalidatePath("/", "layout");
  return { ok: "Vínculo salvo." };
}

const metricSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  spend: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Gasto inválido (use 12.50)."),
  impressions: z.coerce.number().int().min(0),
  reach: z.union([z.literal(""), z.coerce.number().int().min(0)]),
  linkClicks: z.union([z.literal(""), z.coerce.number().int().min(0)]),
  platformLeads: z.union([z.literal(""), z.coerce.number().int().min(0)]),
});

/** Manual daily numbers for a published ad. Same ad + day + source replaces, never adds twice. */
export async function saveDailyMetric(publishedAdId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const user = await requireEditor();
  const ad = await db().publishedAd.findFirst({ where: { id: publishedAdId, brand: { workspaceId: user.workspaceId } } });
  if (!ad) return { error: "Publicação não encontrada." };
  const parsed = metricSchema.safeParse(Object.fromEntries(["date", "spend", "impressions", "reach", "linkClicks", "platformLeads"].map((k) => [k, data.get(k) ?? ""])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const m = parsed.data;
  const date = new Date(`${m.date}T00:00:00Z`);
  const values = {
    spend: m.spend,
    impressions: m.impressions,
    reach: m.reach === "" ? null : m.reach,
    linkClicks: m.linkClicks === "" ? null : m.linkClicks,
    platformLeads: m.platformLeads === "" ? null : m.platformLeads,
  };
  await db().dailyAdInsight.upsert({
    where: { publishedAdId_date_source: { publishedAdId, date, source: "MANUAL" } },
    create: { ...values, publishedAdId, date, source: "MANUAL" },
    update: { ...values, ingestedAt: new Date() },
  });
  revalidatePath("/", "layout");
  return { ok: `Métricas de ${m.date} salvas (fonte: Manual).` };
}

const decisionSchema = z.object({
  action: z.enum(["KEEP_LIVE", "CANCEL", "STOP"], { message: "Escolha a decisão." }),
  note: text(4000),
});

/** Which decisions are allowed from each life-cycle phase. */
const ALLOWED: Record<string, string[]> = { TESTING: ["KEEP_LIVE", "CANCEL"], LIVE: ["STOP"], ENDED: [] };

/**
 * Records the owner decision on an ad (spec 02) with a frozen snapshot of what was known.
 * Suggestion only: the ad itself is paused by the owner on the platform.
 */
export async function recordDecision(publishedAdId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const user = await requireEditor();
  const ad = await db().publishedAd.findFirst({ where: { id: publishedAdId, brand: { workspaceId: user.workspaceId } } });
  if (!ad) return { error: "Publicação não encontrada." };
  const parsed = decisionSchema.safeParse({ action: data.get("action") ?? "", note: data.get("note") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { action, note } = parsed.data;
  if (!ALLOWED[ad.lifecycle].includes(action)) return { error: "Essa decisão não vale para a fase atual do anúncio." };

  const { today, ads } = await loadAdResults(ad.brandId, { adId: ad.id });
  const { summary, evaluation } = ads[0];
  const day = new Date(`${today}T00:00:00Z`);
  const snapshot = JSON.parse(JSON.stringify({ day: evaluation.day, today, total: summary.total, last7: summary.last7, spendSinceLastAppointment: summary.spendSinceLastAppointment, diagnosis: evaluation.diagnosis, alerts: evaluation.alerts }));

  const decision = await db().$transaction(async (tx) => {
    const created = await tx.adDecision.create({
      data: { brandId: ad.brandId, publishedAdId: ad.id, action, suggested: evaluation.verdict, reasons: evaluation.reasons, snapshot, note, decidedById: user.id },
    });
    await tx.publishedAd.update({
      where: { id: ad.id },
      data: action === "KEEP_LIVE" ? { lifecycle: "LIVE", liveSince: day } : { lifecycle: "ENDED", endedAt: day },
    });
    return created;
  });
  await audit({ workspaceId: user.workspaceId, userId: user.id, brandId: ad.brandId, action: "ad_decision.created", entity: "AdDecision", entityId: decision.id, data: { publishedAdId: ad.id, action, suggested: evaluation.verdict } });
  revalidatePath("/", "layout");
  return { ok: action === "KEEP_LIVE" ? "Anúncio marcado como vivo. Agora ele é monitorado." : "Anúncio encerrado. Não esqueça de pausar no Gerenciador de Anúncios." };
}
