/**
 * Dashboard aggregation. Pure: receives rows already filtered by brand and period.
 * Leads are a cohort by creation date; media numbers are by spend date (different windows, on purpose).
 * A lead "reached" a stage if its status history ever passed through it.
 */
import { costPer, scorecard, toCents, type Cents } from "./metrics";

type Money = { toString(): string };

export type LeadRow = {
  status: string;
  history: string[];
  variantAngle: string | null;
  hasSource: boolean;
  estimates: { status: string }[];
  jobs: { contractAmount: Money; directCosts: Money }[];
};

export type InsightRow = { spend: Money; impressions: number; linkClicks: number | null; variantAngle: string | null };

const QUALIFIED = new Set(["QUALIFIED", "APPOINTMENT_SCHEDULED", "APPOINTMENT_COMPLETED", "ESTIMATE_SENT", "WON"]);
const APPOINTMENT = new Set(["APPOINTMENT_SCHEDULED", "APPOINTMENT_COMPLETED", "ESTIMATE_SENT", "WON"]);

const reached = (l: LeadRow, set: Set<string>) => set.has(l.status) || l.history.some((s) => set.has(s));
const isWon = (l: LeadRow) => l.status === "WON" || l.jobs.length > 0;
const sentEstimate = (l: LeadRow) =>
  l.estimates.some((e) => e.status !== "DRAFT") || l.status === "ESTIMATE_SENT" || l.history.includes("ESTIMATE_SENT") || isWon(l);

export function aggregate(leads: LeadRow[], insights: InsightRow[]) {
  const funnel = {
    leads: leads.length,
    qualified: leads.filter((l) => reached(l, QUALIFIED)).length,
    appointments: leads.filter((l) => reached(l, APPOINTMENT)).length,
    estimatesSent: leads.filter(sentEstimate).length,
    won: leads.filter(isWon).length,
  };
  const jobs = leads.flatMap((l) => l.jobs);
  const money = {
    spend: insights.reduce((s, i) => s + toCents(i.spend), 0),
    revenue: jobs.reduce((s, j) => s + toCents(j.contractAmount), 0),
    directCosts: jobs.reduce((s, j) => s + toCents(j.directCosts), 0),
  };
  const media = {
    impressions: insights.reduce((s, i) => s + i.impressions, 0),
    linkClicks: insights.reduce((s, i) => s + (i.linkClicks ?? 0), 0),
  };
  return { funnel, media, card: scorecard(funnel, money, media), byAngle: byAngle(leads, insights), leadsWithoutSource: leads.filter((l) => !l.hasSource).length };
}

export type AngleRow = { angle: string; spend: Cents; leads: number; qualified: number; won: number; cpql: Cents | null; revenue: Cents };

function byAngle(leads: LeadRow[], insights: InsightRow[]): AngleRow[] {
  const angles = new Set<string>([...leads.map((l) => l.variantAngle), ...insights.map((i) => i.variantAngle)].filter((a): a is string => !!a));
  return [...angles]
    .map((angle) => {
      const ls = leads.filter((l) => l.variantAngle === angle);
      const spend = insights.filter((i) => i.variantAngle === angle).reduce((s, i) => s + toCents(i.spend), 0);
      const qualified = ls.filter((l) => reached(l, QUALIFIED)).length;
      return {
        angle,
        spend,
        leads: ls.length,
        qualified,
        won: ls.filter(isWon).length,
        cpql: costPer(spend, qualified),
        revenue: ls.flatMap((l) => l.jobs).reduce((s, j) => s + toCents(j.contractAmount), 0),
      };
    })
    .sort((a, b) => b.qualified - a.qualified || b.leads - a.leads);
}

/** Start of the "last N days" window. */
export function periodStart(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 86_400_000);
}
