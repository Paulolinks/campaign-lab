/**
 * Per-ad numbers for the results history (spec 02). Pure: receives rows already filtered to one ad.
 * Days are "YYYY-MM-DD" strings in the brand timezone, so day math never depends on the server clock zone.
 */
import { costPer, ratio, type Cents } from "./metrics";

export type DailyRow = {
  day: string;
  spendCents: Cents;
  impressions: number;
  reach: number | null;
  linkClicks: number | null;
  platformLeads: number | null;
};

export type AdLeadRow = {
  createdDay: string;
  /** First day the lead reached "appointment scheduled" or a later stage; null if never. */
  appointmentDay: string | null;
  /** Still NEW / CONTACTED: may become an appointment later. */
  isInProgress: boolean;
  hasEstimateSent: boolean;
  isWon: boolean;
  revenueCents: Cents;
  directCostsCents: Cents;
};

export type Totals = {
  spend: Cents;
  impressions: number;
  linkClicks: number;
  hasClickData: boolean;
  /** CRM leads, or the Meta-reported count when it is higher (seller did not register them all yet). */
  leads: number;
  crmLeads: number;
  platformLeads: number;
  appointments: number;
  leadsInProgress: number;
  estimatesSent: number;
  won: number;
  revenue: Cents;
  directCosts: Cents;
  linkCtr: number | null;
  linkCpc: Cents | null;
  cpm: Cents | null;
  cpl: Cents | null;
  costPerAppointment: Cents | null;
  /** Approximate: average of daily impressions/reach where reach was given. */
  frequency: number | null;
  reach: number | null;
};

export type AdSummary = {
  firstSpendDay: string | null;
  lastDataDay: string | null;
  daysWithData: number;
  total: Totals;
  last7: Totals;
  lastAppointmentDay: string | null;
  /** Spend on days after max(last appointment, live since). */
  spendSinceLastAppointment: Cents;
};

const DAY_MS = 86_400_000;

function dayToUtc(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((dayToUtc(b) - dayToUtc(a)) / DAY_MS);
}

export function addDays(day: string, n: number): string {
  return new Date(dayToUtc(day) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Calendar day of `date` in `timeZone`, as YYYY-MM-DD. */
export function dayInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function totals(daily: DailyRow[], leads: AdLeadRow[], appointments: number): Totals {
  const spend = daily.reduce((s, d) => s + d.spendCents, 0);
  const impressions = daily.reduce((s, d) => s + d.impressions, 0);
  const hasClickData = daily.some((d) => d.linkClicks !== null);
  const linkClicks = daily.reduce((s, d) => s + (d.linkClicks ?? 0), 0);
  const platformLeads = daily.reduce((s, d) => s + (d.platformLeads ?? 0), 0);
  const crmLeads = leads.length;
  const withReach = daily.filter((d) => d.reach !== null && d.reach > 0);
  const frequency = withReach.length === 0 ? null : withReach.reduce((s, d) => s + d.impressions / (d.reach as number), 0) / withReach.length;
  const won = leads.filter((l) => l.isWon);
  const revenue = won.reduce((s, l) => s + l.revenueCents, 0);
  return {
    spend,
    impressions,
    linkClicks,
    hasClickData,
    leads: Math.max(crmLeads, platformLeads),
    crmLeads,
    platformLeads,
    appointments,
    leadsInProgress: leads.filter((l) => l.isInProgress).length,
    estimatesSent: leads.filter((l) => l.hasEstimateSent).length,
    won: won.length,
    revenue,
    directCosts: won.reduce((s, l) => s + l.directCostsCents, 0),
    linkCtr: hasClickData ? ratio(linkClicks, impressions) : null,
    linkCpc: hasClickData ? costPer(spend, linkClicks) : null,
    cpm: impressions === 0 ? null : Math.round((1000 * spend) / impressions),
    cpl: costPer(spend, Math.max(crmLeads, platformLeads)),
    costPerAppointment: costPer(spend, appointments),
    frequency,
    reach: withReach.length === 0 ? null : withReach.reduce((s, d) => s + (d.reach as number), 0),
  };
}

/**
 * Summarizes one ad: whole life and the last 7 days ending `today` (inclusive).
 * `liveSince` (day the owner chose "keep live") starts the spend-since-last-appointment count,
 * so test-phase spend never counts against a live ad.
 */
export function summarizeAd(input: { daily: DailyRow[]; leads: AdLeadRow[]; today: string; liveSince: string | null; endDay: string | null }): AdSummary {
  const until = input.endDay ?? input.today;
  const daily = input.daily.filter((d) => d.day <= until).sort((a, b) => a.day.localeCompare(b.day));
  const withSpend = daily.filter((d) => d.spendCents > 0);
  const windowStart = addDays(until, -6);
  const inWindow = (day: string) => day >= windowStart && day <= until;

  const appointmentDays = input.leads.map((l) => l.appointmentDay).filter((d): d is string => d !== null).sort();
  const lastAppointmentDay = appointmentDays.at(-1) ?? null;
  const baseline = [lastAppointmentDay, input.liveSince].filter((d): d is string => d !== null).sort().at(-1) ?? null;

  return {
    firstSpendDay: withSpend[0]?.day ?? null,
    lastDataDay: daily.at(-1)?.day ?? null,
    daysWithData: withSpend.length,
    total: totals(daily, input.leads, appointmentDays.length),
    last7: totals(
      daily.filter((d) => inWindow(d.day)),
      input.leads.filter((l) => inWindow(l.createdDay)),
      // Appointments booked in the window count even if the lead arrived earlier.
      appointmentDays.filter(inWindow).length,
    ),
    lastAppointmentDay,
    spendSinceLastAppointment: daily.filter((d) => baseline === null || d.day > baseline).reduce((s, d) => s + d.spendCents, 0),
  };
}

const SOURCE_PRIORITY: Record<string, number> = { META_API: 3, GOOGLE_ADS_API: 3, CSV: 2, MANUAL: 1 };

/**
 * One row per day: when the same day exists from several sources (Manual, CSV, API),
 * keep the most reliable one so spend is never counted twice.
 */
export function pickOneRowPerDay<T extends { day: string; source: string }>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const cur = best.get(r.day);
    if (!cur || (SOURCE_PRIORITY[r.source] ?? 0) > (SOURCE_PRIORITY[cur.source] ?? 0)) best.set(r.day, r);
  }
  return [...best.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** pickOneRowPerDay across many ads: one row per ad and day (used by the Dashboard). */
export function oneRowPerAdDay<T extends { publishedAdId: string; date: Date; source: string }>(rows: T[]): T[] {
  return pickOneRowPerDay(rows.map((r) => ({ ...r, day: `${r.publishedAdId}|${r.date.toISOString().slice(0, 10)}` })));
}
