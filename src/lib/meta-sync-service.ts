import "server-only";
import type { MetaSyncKind, Prisma } from "@/generated/prisma/client";
import { dayInZone } from "@/domain/ad-results";
import { creativeText, type RawCreative } from "@/domain/agent-access";
import { leadFieldsFromForm, unixSeconds, type FieldData } from "@/domain/meta-leads";
import { normalizeAdAccountId } from "@/domain/meta-check";
import {
  PERIOD_PRESETS,
  budgetFromMinor,
  classifyMetaError,
  dayChunks,
  insightNumbers,
  syncWindow,
  targetingSummary,
  type RawInsight,
} from "@/domain/meta-sync";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { MetaApiError, graphGet, graphList, metaCredentials, type MetaCredentials } from "@/lib/meta";

/**
 * Meta read-only sync (spec 04). Reads campaigns, ad sets, ads, daily numbers, period totals and form leads,
 * and writes them to our tables. Only GET calls: nothing is ever changed on Meta.
 * Who calls it does not matter (button, scheduler, a future worker): the lock lives in MetaSyncRun.
 */

const LOCK_MINUTES = 30;
const RATE_LIMIT_WAIT_MINUTES = 60;
/** Leads are asked again from a little before the last successful run, so a lead created during it is not missed. */
const LEADS_OVERLAP_MINUTES = 15;
const ATTRIBUTION = { use_unified_attribution_setting: "true" };
const INSIGHT_FIELDS = "spend,impressions,reach,frequency,clicks,inline_link_clicks,actions";

export type SyncTrigger = "MANUAL" | "SCHEDULED";
export type SyncCounts = { campaigns: number; adSets: number; ads: number; days: number; leads: number };
export type SyncResult =
  | { ok: true; runId: string; counts: SyncCounts }
  | { ok: false; runId: string | null; step: string; message: string; locked?: boolean; retryAfter?: Date };

const LOCK_GROUP: Record<MetaSyncKind, MetaSyncKind[]> = { FULL: ["FULL", "INCREMENTAL"], INCREMENTAL: ["FULL", "INCREMENTAL"], LEADS: ["LEADS"] };

/** True when another run of the same group started less than 30 minutes ago and has not finished. */
export async function isSyncRunning(brandId: string, kind: MetaSyncKind): Promise<boolean> {
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000);
  return !!(await db().metaSyncRun.findFirst({ where: { brandId, kind: { in: LOCK_GROUP[kind] }, status: "RUNNING", startedAt: { gte: since } } }));
}

/** Runs started before the current ad account was set belong to another account. */
async function accountSince(brandId: string): Promise<Date> {
  const conn = await db().metaConnection.findUnique({ where: { brandId }, select: { accountChangedAt: true } });
  return conn?.accountChangedAt ?? new Date(0);
}

/** FULL the first time for the current ad account (no successful metrics run yet), INCREMENTAL after that. */
export async function nextMetricsKind(brandId: string): Promise<"FULL" | "INCREMENTAL"> {
  const done = await db().metaSyncRun.findFirst({
    where: { brandId, kind: { in: ["FULL", "INCREMENTAL"] }, status: "SUCCESS", startedAt: { gte: await accountSince(brandId) } },
  });
  return done ? "INCREMENTAL" : "FULL";
}

export async function runMetaSync(brandId: string, opts: { kind: MetaSyncKind; trigger: SyncTrigger; userId?: string }): Promise<SyncResult> {
  if (await isSyncRunning(brandId, opts.kind)) return { ok: false, runId: null, step: "Início", message: "Já está sincronizando. Espere terminar.", locked: true };
  const creds = await metaCredentials(brandId);
  if (!creds) return { ok: false, runId: null, step: "Início", message: "Conecte a Meta em Integrações primeiro." };
  const accountId = normalizeAdAccountId(creds.adAccountId);
  if (!accountId) return { ok: false, runId: null, step: "Início", message: "ID da conta de anúncios inválido em Integrações." };

  const run = await db().metaSyncRun.create({ data: { brandId, kind: opts.kind, trigger: opts.trigger, userId: opts.userId ?? null } });
  const counts: SyncCounts = { campaigns: 0, adSets: 0, ads: 0, days: 0, leads: 0 };
  const progress = { step: "Conta de anúncios" };
  try {
    if (opts.kind === "LEADS") await syncLeads(brandId, creds, counts, progress);
    else await syncMetrics(brandId, accountId, creds, opts.kind, counts, progress);
    await db().metaSyncRun.update({ where: { id: run.id }, data: { status: "SUCCESS", finishedAt: new Date(), counts, step: null } });
    if (opts.kind !== "LEADS") {
      await db().channelAccount.updateMany({ where: { brandId, platform: "META", externalAccountId: accountId }, data: { connectionStatus: "CONNECTED", lastSyncAt: new Date(), lastError: null } });
    }
    if (opts.userId) await auditRun(brandId, opts.userId, opts.kind, { counts });
    return { ok: true, runId: run.id, counts };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    const kind = err instanceof MetaApiError ? classifyMetaError(err.code, err.subcode) : "OTHER";
    const retryAfter = kind === "RATE_LIMIT" ? new Date(Date.now() + RATE_LIMIT_WAIT_MINUTES * 60_000) : undefined;
    const friendly =
      kind === "RATE_LIMIT" ? `A Meta pediu para esperar. Tentaremos de novo depois. (${message})`
      : kind === "AUTH" ? `O token não vale mais. Gere um novo e cole em Integrações. (${message})`
      : kind === "PERMISSION" ? `Falta permissão no token${opts.kind === "LEADS" ? " (leads_retrieval)" : " (ads_read)"}. (${message})`
      : message;
    await db().metaSyncRun.update({
      where: { id: run.id },
      data: { status: "ERROR", finishedAt: new Date(), counts, step: progress.step, error: friendly.slice(0, 1000), retryAfter: retryAfter ?? null },
    });
    if (kind === "AUTH") {
      await db().channelAccount.updateMany({ where: { brandId, platform: "META" }, data: { connectionStatus: "ERROR", lastError: friendly.slice(0, 500) } });
    }
    if (opts.userId) await auditRun(brandId, opts.userId, opts.kind, { counts, step: progress.step, error: friendly.slice(0, 500) });
    return { ok: false, runId: run.id, step: progress.step, message: friendly, retryAfter };
  }
}

async function auditRun(brandId: string, userId: string, kind: MetaSyncKind, data: Prisma.InputJsonValue) {
  const brand = await db().brand.findUniqueOrThrow({ where: { id: brandId }, select: { workspaceId: true } });
  await audit({ workspaceId: brand.workspaceId, userId, brandId, action: "meta.sync_manual", entity: "Integration", entityId: `META:${kind}`, data });
}

const toDate = (v: string | undefined | null) => (v ? new Date(v) : null);
const dbDay = (day: string) => new Date(`${day}T00:00:00Z`);

type RawCampaign = { id: string; name: string; objective?: string; status?: string; effective_status?: string; daily_budget?: string; lifetime_budget?: string; start_time?: string; stop_time?: string; created_time?: string };
type RawAdSet = RawCampaign & { campaign_id: string; optimization_goal?: string; end_time?: string; targeting?: Parameters<typeof targetingSummary>[0] };
type RawAd = { id: string; name: string; adset_id?: string; campaign_id?: string; status?: string; effective_status?: string; created_time?: string; creative?: { thumbnail_url?: string } };

async function syncMetrics(brandId: string, accountId: string, creds: MetaCredentials, kind: "FULL" | "INCREMENTAL", counts: SyncCounts, progress: { step: string }) {
  const account = await graphGet<{ currency: string; timezone_name: string }>(creds, accountId, "currency,timezone_name");
  const now = new Date();
  const channel = await db().channelAccount.findFirst({ where: { brandId, platform: "META", externalAccountId: accountId }, select: { id: true } });

  progress.step = "Campanhas";
  const campaigns = await graphList<RawCampaign>(creds, `${accountId}/campaigns`, {
    fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time,created_time",
  });
  for (const c of campaigns) {
    const data = {
      name: c.name, objective: c.objective ?? null, status: c.status ?? null, effectiveStatus: c.effective_status ?? null,
      dailyBudget: budgetFromMinor(c.daily_budget, account.currency), lifetimeBudget: budgetFromMinor(c.lifetime_budget, account.currency),
      startTime: toDate(c.start_time), stopTime: toDate(c.stop_time), externalCreatedAt: toDate(c.created_time), lastSyncAt: now,
    };
    await db().metaCampaign.upsert({ where: { brandId_externalId: { brandId, externalId: c.id } }, create: { brandId, externalId: c.id, ...data }, update: data });
  }
  counts.campaigns = campaigns.length;

  progress.step = "Conjuntos de anúncios";
  const adSets = await graphList<RawAdSet>(creds, `${accountId}/adsets`, {
    fields: "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,start_time,end_time,created_time,targeting",
  });
  for (const a of adSets) {
    const data = {
      campaignExternalId: a.campaign_id, name: a.name, status: a.status ?? null, effectiveStatus: a.effective_status ?? null,
      dailyBudget: budgetFromMinor(a.daily_budget, account.currency), lifetimeBudget: budgetFromMinor(a.lifetime_budget, account.currency),
      optimizationGoal: a.optimization_goal ?? null, targetingSummary: targetingSummary(a.targeting),
      startTime: toDate(a.start_time), endTime: toDate(a.end_time), externalCreatedAt: toDate(a.created_time), lastSyncAt: now,
    };
    await db().metaAdSet.upsert({ where: { brandId_externalId: { brandId, externalId: a.id } }, create: { brandId, externalId: a.id, ...data }, update: data });
  }
  counts.adSets = adSets.length;

  progress.step = "Anúncios";
  const ads = await graphList<RawAd>(creds, `${accountId}/ads`, { fields: "id,name,adset_id,campaign_id,status,effective_status,created_time,creative{thumbnail_url}" });
  const adIds = new Map<string, string>();
  for (const a of ads) {
    const data = {
      name: a.name, externalCampaignId: a.campaign_id ?? null, externalAdSetId: a.adset_id ?? null, externalStatus: a.status ?? null,
      effectiveStatus: a.effective_status ?? null, thumbnailUrl: a.creative?.thumbnail_url ?? null, externalCreatedAt: toDate(a.created_time), lastSyncAt: now,
    };
    // Same unique key as the manual link in Publicados: an ad linked by hand is updated, never duplicated.
    const row = await db().publishedAd.upsert({
      where: { brandId_platform_externalAdId: { brandId, platform: "META", externalAdId: a.id } },
      create: { brandId, platform: "META", externalAdId: a.id, channelAccountId: channel?.id ?? null, publishedAt: toDate(a.created_time), ...data },
      update: data,
      select: { id: true },
    });
    adIds.set(a.id, row.id);
  }
  counts.ads = ads.length;

  progress.step = "Textos dos anúncios";
  await syncCreatives(creds, accountId, adIds);

  progress.step = "Números por dia";
  const today = dayInZone(now, account.timezone_name);
  const window = syncWindow(kind, today);
  for (const chunk of dayChunks(window.since, window.until)) {
    const rows = await graphList<RawInsight>(creds, `${accountId}/insights`, {
      level: "ad", time_increment: "1", time_range: JSON.stringify(chunk), ...ATTRIBUTION,
      fields: `ad_id,ad_name,adset_id,campaign_id,date_start,${INSIGHT_FIELDS}`,
    });
    for (const r of rows) {
      if (!r.ad_id || !r.date_start) continue;
      const publishedAdId = adIds.get(r.ad_id) ?? (await adFromInsight(brandId, r, channel?.id ?? null, now));
      adIds.set(r.ad_id, publishedAdId);
      const n = insightNumbers(r);
      const data = {
        spend: n.spend, impressions: n.impressions, reach: n.reach, clicks: n.clicks, linkClicks: n.linkClicks, platformLeads: n.leads,
        actions: (r.actions ?? []) as Prisma.InputJsonValue, ingestedAt: now,
      };
      // Re-reading a day replaces it (Meta keeps adjusting recent days); it is never added twice.
      await db().dailyAdInsight.upsert({
        where: { publishedAdId_date_source: { publishedAdId, date: dbDay(r.date_start), source: "META_API" } },
        create: { publishedAdId, date: dbDay(r.date_start), source: "META_API", ...data },
        update: data,
      });
      counts.days++;
    }
  }

  progress.step = "Totais por período";
  for (const level of ["campaign", "adset", "ad"] as const) {
    for (const p of PERIOD_PRESETS) {
      const rows = await graphList<RawInsight & Record<string, string>>(creds, `${accountId}/insights`, {
        level, date_preset: p.key, ...ATTRIBUTION, fields: `${level}_id,${INSIGHT_FIELDS}`,
      });
      const data = rows.flatMap((r) => {
          const externalId = r[`${level}_id`];
          if (!externalId) return [];
          const n = insightNumbers(r);
          return {
            brandId, level, externalId, preset: p.key, syncedAt: now,
            spend: n.spend, impressions: n.impressions, reach: n.reach, frequency: n.frequency, clicks: n.clicks, linkClicks: n.linkClicks, leads: n.leads,
          };
        });
      // Replaced as a whole, so an ad without numbers in the period does not keep an old total.
      await db().$transaction([
        db().metaPeriodInsight.deleteMany({ where: { brandId, level, preset: p.key } }),
        db().metaPeriodInsight.createMany({ data }),
      ]);
    }
  }
}

const CREATIVE_FIELDS = "creative{title,body,call_to_action_type,image_url,video_id,thumbnail_url,object_story_spec,asset_feed_spec}";

/**
 * Ad text and media (spec 05), so the analyst can judge the message and not only the numbers.
 * Optional: if Meta refuses these fields, the numbers are still synced.
 */
async function syncCreatives(creds: MetaCredentials, accountId: string, adIds: Map<string, string>) {
  let rows: { id: string; creative?: RawCreative }[];
  try {
    rows = await graphList(creds, `${accountId}/ads`, { fields: `id,${CREATIVE_FIELDS}` });
  } catch (err) {
    console.warn(`[meta-sync] ad texts skipped: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  for (const r of rows) {
    const id = adIds.get(r.id);
    const creative = creativeText(r.creative);
    if (id && creative) await db().publishedAd.update({ where: { id }, data: { creative } });
  }
}

/** An ad Meta no longer lists (archived or deleted) still has history: keep it with what the insights row says. */
async function adFromInsight(brandId: string, r: RawInsight, channelAccountId: string | null, now: Date): Promise<string> {
  const data = { name: r.ad_name ?? null, externalCampaignId: r.campaign_id ?? null, externalAdSetId: r.adset_id ?? null, lastSyncAt: now };
  const row = await db().publishedAd.upsert({
    where: { brandId_platform_externalAdId: { brandId, platform: "META", externalAdId: r.ad_id! } },
    create: { brandId, platform: "META", externalAdId: r.ad_id!, channelAccountId, ...data },
    update: data,
    select: { id: true },
  });
  return row.id;
}

type RawLead = { id: string; created_time: string; ad_id?: string; form_id?: string; field_data?: FieldData };

async function syncLeads(brandId: string, creds: MetaCredentials, counts: SyncCounts, progress: { step: string }) {
  progress.step = "Leads dos formulários";
  const last = await db().metaSyncRun.findFirst({
    where: { brandId, kind: "LEADS", status: "SUCCESS", startedAt: { gte: await accountSince(brandId) } },
    orderBy: { startedAt: "desc" },
  });
  const since = last ? new Date(last.startedAt.getTime() - LEADS_OVERLAP_MINUTES * 60_000) : null;
  const recent = new Date(Date.now() - 3 * 86_400_000);

  // First time: every ad that ever had a lead. After that: ads running now or with a lead in the last 3 days.
  const ads = await db().publishedAd.findMany({
    where: {
      brandId, platform: "META",
      OR: since
        ? [{ effectiveStatus: "ACTIVE" }, { insights: { some: { platformLeads: { gt: 0 }, date: { gte: recent } } } }]
        : [{ effectiveStatus: "ACTIVE" }, { insights: { some: { platformLeads: { gt: 0 } } } }],
    },
    select: { id: true, externalAdId: true, variantId: true, variant: { select: { campaignId: true } } },
  });

  for (const ad of ads) {
    const params: Record<string, string> = { fields: "id,created_time,ad_id,form_id,field_data" };
    if (since) params.filtering = JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: unixSeconds(since) }]);
    const leads = await graphList<RawLead>(creds, `${ad.externalAdId}/leads`, params);
    for (const l of leads) if (await saveLead(brandId, l, ad)) counts.leads++;
  }
}

/** Creates the lead, or attaches the Meta id to an existing lead with the same phone/e-mail. Returns true when new. */
async function saveLead(brandId: string, l: RawLead, ad: { id: string; variantId: string | null; variant: { campaignId: string } | null }): Promise<boolean> {
  if (await db().lead.findUnique({ where: { brandId_externalLeadId: { brandId, externalLeadId: l.id } }, select: { id: true } })) return false;
  const f = leadFieldsFromForm(l.field_data);
  const formAnswers = (l.field_data ?? []) as Prisma.InputJsonValue;
  const same = f.phone || f.email
    ? await db().lead.findFirst({ where: { brandId, externalLeadId: null, OR: [...(f.phone ? [{ phone: f.phone }] : []), ...(f.email ? [{ email: f.email }] : [])] } })
    : null;
  if (same) {
    await db().lead.update({
      where: { id: same.id },
      data: { externalLeadId: l.id, formAnswers, publishedAdId: same.publishedAdId ?? ad.id, variantId: same.variantId ?? ad.variantId, sourcePlatform: same.sourcePlatform ?? "META" },
    });
    return false;
  }
  const createdAt = new Date(l.created_time);
  await db().lead.create({
    data: {
      brandId, name: f.name, phone: f.phone, email: f.email, zip: f.zip, externalLeadId: l.id, formAnswers,
      sourcePlatform: "META", sourceConfidence: "CONFIRMED", publishedAdId: ad.id, variantId: ad.variantId, campaignId: ad.variant?.campaignId ?? null,
      createdAt, statusChanges: { create: { to: "NEW", createdAt } },
    },
  });
  return true;
}

/** Last run of each group for the Integrações panel and the Gerenciador footer. */
export async function lastSyncRuns(brandId: string) {
  const [metrics, metricsOk, leads] = await Promise.all([
    db().metaSyncRun.findFirst({ where: { brandId, kind: { in: ["FULL", "INCREMENTAL"] } }, orderBy: { startedAt: "desc" } }),
    db().metaSyncRun.findFirst({ where: { brandId, kind: { in: ["FULL", "INCREMENTAL"] }, status: "SUCCESS" }, orderBy: { startedAt: "desc" } }),
    db().metaSyncRun.findFirst({ where: { brandId, kind: "LEADS" }, orderBy: { startedAt: "desc" } }),
  ]);
  return { metrics, metricsOk, leads };
}

/** Called by the scheduler: every brand with a saved Meta connection, one at a time. */
export async function runScheduledSync(job: "metrics" | "leads") {
  const brands = await db().metaConnection.findMany({ select: { brandId: true } });
  const out: { brandId: string; ok: boolean; message?: string }[] = [];
  for (const { brandId } of brands) {
    const waiting = await db().metaSyncRun.findFirst({ where: { brandId, retryAfter: { gt: new Date() } }, orderBy: { startedAt: "desc" } });
    if (waiting) {
      out.push({ brandId, ok: false, message: "Esperando a Meta liberar (limite de chamadas)." });
      continue;
    }
    const kind = job === "leads" ? "LEADS" : await nextMetricsKind(brandId);
    // Leads come from ads we already know; skip until the first metrics run has listed them.
    if (kind === "LEADS" && (await nextMetricsKind(brandId)) === "FULL") continue;
    const r = await runMetaSync(brandId, { kind, trigger: "SCHEDULED" });
    out.push({ brandId, ok: r.ok, ...(r.ok ? {} : { message: r.message }) });
  }
  return out;
}
