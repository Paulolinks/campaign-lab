import "server-only";
import { evaluateAd, parseRules, type BrandTargets, type Evaluation } from "@/domain/ad-decision";
import { dayInZone, pickOneRowPerDay, summarizeAd, type AdLeadRow, type AdSummary, type DailyRow } from "@/domain/ad-results";
import { APPOINTMENT_OR_LATER, toCents } from "@/domain/metrics";
import { db } from "@/lib/db";

const DEFAULT_AD_DAILY_BUDGET_CENTS = 2000;
const APPOINTMENT = new Set<string>(APPOINTMENT_OR_LATER);
const IN_PROGRESS = new Set(["NEW", "CONTACTED", "QUALIFIED"]);

const dbDay = (d: Date) => d.toISOString().slice(0, 10); // @db.Date columns are stored as UTC midnight

const adInclude = {
  insights: { select: { date: true, source: true, spend: true, impressions: true, reach: true, linkClicks: true, platformLeads: true } },
  variant: { select: { id: true, adKey: true, angle: true, hook: true, headline: true, campaign: { select: { id: true, name: true, campaignKey: true, hypothesis: true, testVariable: true, persona: true, budgetPerDay: true } } } },
  leads: {
    select: {
      status: true, createdAt: true,
      statusChanges: { select: { to: true, createdAt: true }, orderBy: { createdAt: "asc" as const } },
      estimates: { select: { status: true } },
      jobs: { select: { contractAmount: true, directCosts: true } },
    },
  },
  decisions: { orderBy: { decidedAt: "desc" as const } },
} as const;

export type AdResult = Awaited<ReturnType<typeof loadAdResults>>["ads"][number];

/**
 * Loads published ads of a brand with their summary and verdict for today (brand timezone).
 * `adId` limits the result to one ad (still scoped by brand: never trust ids from the client).
 */
export async function loadAdResults(brandId: string, opts: { adId?: string; now?: Date } = {}) {
  const brand = await db().brand.findUniqueOrThrow({ where: { id: brandId } });
  const today = dayInZone(opts.now ?? new Date(), brand.timezone);
  const rules = parseRules(brand.decisionRules);
  const rows = await db().publishedAd.findMany({
    where: { brandId, ...(opts.adId ? { id: opts.adId } : {}) },
    orderBy: { createdAt: "desc" },
    include: adInclude,
  });

  const prepared = rows.map((ad) => {
    const tz = brand.timezone;
    const daily: DailyRow[] = pickOneRowPerDay(ad.insights.map((i) => ({ ...i, day: dbDay(i.date) }))).map((i) => ({
      day: i.day, spendCents: toCents(i.spend), impressions: i.impressions, reach: i.reach, linkClicks: i.linkClicks, platformLeads: i.platformLeads,
    }));
    const leads: AdLeadRow[] = ad.leads.map((l) => {
      const reachedAt = l.statusChanges.find((c) => APPOINTMENT.has(c.to))?.createdAt ?? (APPOINTMENT.has(l.status) ? l.createdAt : null);
      const isWon = l.status === "WON" || l.jobs.length > 0;
      return {
        createdDay: dayInZone(l.createdAt, tz),
        appointmentDay: reachedAt ? dayInZone(reachedAt, tz) : null,
        isInProgress: IN_PROGRESS.has(l.status),
        hasEstimateSent: l.status === "ESTIMATE_SENT" || l.estimates.some((e) => e.status !== "DRAFT") || isWon,
        isWon,
        revenueCents: l.jobs.reduce((s, j) => s + toCents(j.contractAmount), 0),
        directCostsCents: l.jobs.reduce((s, j) => s + toCents(j.directCosts), 0),
      };
    });
    const summary: AdSummary = summarizeAd({
      daily, leads, today,
      liveSince: ad.liveSince ? dbDay(ad.liveSince) : null,
      endDay: ad.endedAt ? dbDay(ad.endedAt) : null,
    });
    return { ad, daily, summary };
  });

  // Brand-wide count of ads spending now, for the daily cap alert.
  const activeAdsCount = opts.adId
    ? await countActiveAds(brandId)
    : prepared.filter((p) => p.ad.lifecycle !== "ENDED" && p.summary.firstSpendDay !== null).length;

  const targets: BrandTargets = {
    currency: brand.currency,
    adDailyBudgetCents: brand.adDailyBudget ? toCents(brand.adDailyBudget) : DEFAULT_AD_DAILY_BUDGET_CENTS,
    targetCostPerAppointmentCents: brand.targetCostPerAppointment ? toCents(brand.targetCostPerAppointment) : null,
    maxDailySpendCents: brand.maxDailySpend ? toCents(brand.maxDailySpend) : null,
    activeAdsCount,
  };

  const ads = prepared.map(({ ad, daily, summary }) => {
    const evaluation: Evaluation = evaluateAd(summary, { phase: ad.lifecycle, maxDaySpendCents: Math.max(0, ...daily.map((d) => d.spendCents)) }, targets, rules, today);
    return { ad, daily, summary, evaluation };
  });
  return { brand, targets, rules, today, ads };
}

async function countActiveAds(brandId: string) {
  return db().publishedAd.count({ where: { brandId, lifecycle: { not: "ENDED" }, insights: { some: { spend: { gt: 0 } } } } });
}
