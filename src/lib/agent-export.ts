import "server-only";
import { answersWithoutPii, hashAgentKey, readAgentKey } from "@/domain/agent-access";
import { db } from "@/lib/db";

/**
 * Read-only data for the marketing analyst (Claude), spec 05.
 * Everything the analysis needs (plans, Meta structure, ad texts, daily numbers, funnel, money), never lead PII.
 */

/** The valid, not revoked key of the request, or null. Marks the key as used. */
export async function agentKeyOf(request: Request) {
  const key = readAgentKey((n) => request.headers.get(n));
  if (!key) return null;
  const row = await db().agentAccessKey.findUnique({ where: { keyHash: hashAgentKey(key) } });
  if (!row || row.revokedAt) return null;
  await db().agentAccessKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return row;
}

/** Workspace of a valid, not revoked key, or null. */
export async function workspaceForAgent(request: Request): Promise<string | null> {
  return (await agentKeyOf(request))?.workspaceId ?? null;
}

const num = (v: { toString(): string } | null | undefined) => (v == null ? null : Number(v.toString()));
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export async function listBrandsForAgent(workspaceId: string) {
  const brands = await db().brand.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true, industry: true, timezone: true, currency: true, metaConnection: { select: { adAccountId: true } } },
  });
  return brands.map(({ metaConnection, ...b }) => ({ ...b, metaAdAccountId: metaConnection?.adAccountId ?? null }));
}

export type ExportOptions = { since: Date | null; withActions: boolean };

export async function exportBrandForAgent(workspaceId: string, brandId: string, opts: ExportOptions) {
  const brand = await db().brand.findFirst({ where: { id: brandId, workspaceId } });
  if (!brand) return null;
  const where = { brandId };
  const dateFilter = opts.since ? { gte: opts.since } : undefined;

  const [persona, plans, metaCampaigns, metaAdSets, ads, periodInsights, daily, leads, decisions, syncRuns] = await Promise.all([
    db().personaVersion.findFirst({ where, orderBy: [{ approved: "desc" }, { createdAt: "desc" }], select: { name: true, version: true, content: true, createdAt: true } }),
    db().campaignPlan.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        campaignKey: true, name: true, persona: true, service: true, objective: true, hypothesis: true, channels: true, landingUrl: true, market: true,
        testVariable: true, ctaDestination: true, budgetPerDay: true, status: true, startDate: true, endDate: true, notes: true,
        variants: {
          select: {
            adKey: true, name: true, angle: true, format: true, funnelStage: true, hook: true, primaryText: true, headline: true, description: true, cta: true,
            visualDirection: true, videoScript: true, status: true, testLabel: true, approvalStatus: true, version: true,
          },
        },
      },
    }),
    db().metaCampaign.findMany({ where, orderBy: { externalCreatedAt: "asc" } }),
    db().metaAdSet.findMany({ where, orderBy: { externalCreatedAt: "asc" } }),
    db().publishedAd.findMany({
      where,
      orderBy: { externalCreatedAt: "asc" },
      select: {
        id: true, platform: true, externalAdId: true, externalCampaignId: true, externalAdSetId: true, name: true, effectiveStatus: true, externalStatus: true,
        thumbnailUrl: true, creative: true, externalCreatedAt: true, publishedAt: true, lifecycle: true, liveSince: true, endedAt: true, utmUrl: true,
        variant: { select: { adKey: true } },
      },
    }),
    db().metaPeriodInsight.findMany({ where, orderBy: [{ level: "asc" }, { preset: "asc" }] }),
    db().dailyAdInsight.findMany({
      where: { publishedAd: { brandId }, ...(dateFilter ? { date: dateFilter } : {}) },
      orderBy: [{ date: "asc" }],
      select: {
        date: true, source: true, spend: true, impressions: true, reach: true, clicks: true, linkClicks: true, platformLeads: true,
        actions: opts.withActions, publishedAd: { select: { externalAdId: true } },
      },
    }),
    db().lead.findMany({
      where: { brandId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, createdAt: true, status: true, requestedService: true, zip: true, urgency: true, primaryPriority: true, reasonLost: true,
        sourcePlatform: true, sourceConfidence: true, utmSource: true, utmMedium: true, utmCampaign: true, utmContent: true, formAnswers: true,
        externalLeadId: true,
        campaign: { select: { campaignKey: true } },
        variant: { select: { adKey: true } },
        publishedAd: { select: { externalAdId: true } },
        statusChanges: { orderBy: { createdAt: "asc" }, select: { from: true, to: true, createdAt: true } },
        estimates: { select: { amount: true, status: true, sentAt: true } },
        jobs: { select: { contractAmount: true, directCosts: true, closeDate: true } },
      },
    }),
    db().adDecision.findMany({
      where,
      orderBy: { decidedAt: "asc" },
      select: { action: true, suggested: true, reasons: true, snapshot: true, note: true, decidedAt: true, publishedAd: { select: { externalAdId: true } } },
    }),
    db().metaSyncRun.findMany({ where, orderBy: { startedAt: "desc" }, take: 5, select: { kind: true, status: true, startedAt: true, finishedAt: true, counts: true, step: true, error: true } }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    notes: [
      "Read-only export for the marketing analyst. Money in the brand/ad account currency.",
      "Lead names, phones, e-mails, addresses and free-text notes are never included.",
      "daily: one row per ad per day and source; META_API rows are Meta's own numbers (unified attribution).",
      "periodInsights: Meta totals per period; reach/frequency are only valid there, never summed from daily rows.",
    ],
    brand: {
      id: brand.id, name: brand.name, industry: brand.industry, serviceArea: brand.serviceArea, timezone: brand.timezone, currency: brand.currency,
      forbiddenTerms: brand.forbiddenTerms, adDailyBudget: num(brand.adDailyBudget), targetCostPerAppointment: num(brand.targetCostPerAppointment),
      maxDailySpend: num(brand.maxDailySpend), decisionRules: brand.decisionRules,
    },
    persona,
    plans: plans.map((p) => ({ ...p, budgetPerDay: num(p.budgetPerDay), startDate: day(p.startDate), endDate: day(p.endDate) })),
    meta: {
      campaigns: metaCampaigns.map(({ brandId: _b, id: _i, ...c }) => ({ ...c, dailyBudget: num(c.dailyBudget), lifetimeBudget: num(c.lifetimeBudget) })),
      adSets: metaAdSets.map(({ brandId: _b, id: _i, ...a }) => ({ ...a, dailyBudget: num(a.dailyBudget), lifetimeBudget: num(a.lifetimeBudget) })),
      lastSyncRuns: syncRuns,
    },
    ads: ads.map(({ variant, id: _i, ...a }) => ({ ...a, variantKey: variant?.adKey ?? null, liveSince: day(a.liveSince), endedAt: day(a.endedAt) })),
    periodInsights: periodInsights.map(({ brandId: _b, id: _i, ...p }) => ({ ...p, spend: num(p.spend) })),
    daily: daily.map(({ publishedAd, date, spend, ...d }) => ({ ad: publishedAd.externalAdId, date: day(date), spend: num(spend), ...d })),
    leads: leads.map(({ formAnswers, campaign, variant, publishedAd, estimates, jobs, ...l }) => ({
      ...l,
      campaignKey: campaign?.campaignKey ?? null,
      variantKey: variant?.adKey ?? null,
      ad: publishedAd?.externalAdId ?? null,
      answers: answersWithoutPii(formAnswers),
      estimates: estimates.map((e) => ({ ...e, amount: num(e.amount) })),
      jobs: jobs.map((j) => ({ contractAmount: num(j.contractAmount), directCosts: num(j.directCosts), closeDate: day(j.closeDate) })),
    })),
    decisions: decisions.map(({ publishedAd, ...d }) => ({ ...d, ad: publishedAd.externalAdId })),
  };
}
