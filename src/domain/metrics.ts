/**
 * Business metrics. Money is handled in integer cents to avoid float drift.
 * Any metric without a denominator returns null, which the UI shows as "N/D" — never 0.
 */

export type Cents = number;

/** "1234.5" | 1234.5 | Decimal-like → 123450 */
export function toCents(value: { toString(): string } | string | number | null | undefined): Cents {
  if (value === null || value === undefined) return 0;
  const s = typeof value === "string" ? value : value.toString();
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

/** Money divided by a count, in cents, or null without a denominator. */
export function costPer(spend: Cents, count: number): Cents | null {
  return count === 0 ? null : Math.round(spend / count);
}

export type FunnelCounts = {
  leads: number;
  qualified: number;
  appointments: number;
  estimatesSent: number;
  won: number;
};

export type MoneyTotals = {
  spend: Cents;
  revenue: Cents;
  directCosts: Cents;
};

export type Scorecard = ReturnType<typeof scorecard>;

export function scorecard(f: FunnelCounts, m: MoneyTotals, media: { impressions: number; linkClicks: number }) {
  const contribution = m.revenue - m.directCosts; // before media
  return {
    spend: m.spend,
    leads: f.leads,
    qualified: f.qualified,
    estimatesSent: f.estimatesSent,
    won: f.won,
    revenue: m.revenue,
    directCosts: m.directCosts,
    /** revenue − direct costs − media. Not net profit (no overhead/taxes). */
    contributionAfterMedia: m.revenue === 0 && m.spend === 0 ? null : contribution - m.spend,
    cpm: media.impressions === 0 ? null : Math.round((1000 * m.spend) / media.impressions),
    linkCtr: ratio(media.linkClicks, media.impressions),
    linkCpc: costPer(m.spend, media.linkClicks),
    cpl: costPer(m.spend, f.leads),
    cpql: costPer(m.spend, f.qualified),
    qualificationRate: ratio(f.qualified, f.leads),
    appointmentRate: ratio(f.appointments, f.leads),
    closeRate: ratio(f.won, f.estimatesSent),
    cac: costPer(m.spend, f.won),
    grossMargin: m.revenue === 0 ? null : contribution / m.revenue,
    roas: m.spend === 0 ? null : m.revenue / m.spend,
    mediaRoi: m.spend === 0 ? null : (contribution - m.spend) / m.spend,
  };
}

/** Lead statuses that count as "reached at least this stage". */
export const QUALIFIED_OR_LATER = [
  "QUALIFIED", "APPOINTMENT_SCHEDULED", "APPOINTMENT_COMPLETED", "ESTIMATE_SENT", "WON", "LOST",
] as const;
export const APPOINTMENT_OR_LATER = ["APPOINTMENT_SCHEDULED", "APPOINTMENT_COMPLETED", "ESTIMATE_SENT", "WON"] as const;

export function formatMoney(cents: Cents | null, currency = "USD"): string {
  if (cents === null) return "N/D";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function formatPercent(value: number | null): string {
  if (value === null) return "N/D";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatRatio(value: number | null): string {
  if (value === null) return "N/D";
  return `${value.toFixed(2)}x`;
}
