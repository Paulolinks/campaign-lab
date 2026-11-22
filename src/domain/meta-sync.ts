/**
 * Pure helpers for the Meta read-only sync (spec 04): turning Graph API answers into rows, choosing which
 * days to read and classifying Meta errors. No network and no database here.
 */

/** Periods shown in the Gerenciador, with the Meta `date_preset` of each one. */
export const PERIOD_PRESETS = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "last_7d", label: "Últimos 7 dias" },
  { key: "last_30d", label: "Últimos 30 dias" },
  { key: "this_month", label: "Este mês" },
  { key: "maximum", label: "Máximo" },
] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number]["key"];

/** Meta keeps insights for 37 months; asking further back is an error (code 3018). */
export const HISTORY_MONTHS = 37;
/** Incremental runs re-read this many days (today included), because Meta keeps adjusting recent days. */
export const RECENT_DAYS = 7;
/** Days per insights request when reading history, to stay under Meta's response time limit. */
export const CHUNK_DAYS = 30;

// Currencies without cents: Meta sends their budgets in whole units.
const ZERO_DECIMAL = new Set(["JPY", "KRW", "CLP", "COP", "CRC", "HUF", "ISK", "IDR", "PYG", "TWD", "VND"]);

/** Meta budget ("2000" = US$ 20.00) → decimal string in the account currency, or null when absent/zero. */
export function budgetFromMinor(raw: string | number | null | undefined, currency: string): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? n.toFixed(2) : (n / 100).toFixed(2);
}

type Action = { action_type?: string; value?: string | number };

/**
 * Leads reported by Meta in an `actions` list. "lead" already adds up form and website leads, so it wins;
 * the other types are only used when "lead" is missing, never summed with it.
 */
export function leadsFromActions(actions: Action[] | null | undefined): number | null {
  if (!actions?.length) return null;
  const find = (t: string) => actions.find((a) => a.action_type === t);
  const hit = find("lead") ?? find("onsite_conversion.lead_grouped") ?? find("offsite_conversion.fb_pixel_lead");
  return hit ? Math.round(Number(hit.value ?? 0)) : null;
}

const int = (v: unknown) => (v === undefined || v === null || v === "" ? null : Math.round(Number(v)));
const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));

export type RawInsight = {
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: Action[];
};

export type InsightNumbers = {
  spend: string;
  impressions: number;
  reach: number | null;
  frequency: number | null;
  clicks: number | null;
  linkClicks: number | null;
  leads: number | null;
};

export function insightNumbers(raw: RawInsight): InsightNumbers {
  return {
    spend: Number(raw.spend ?? 0).toFixed(2),
    impressions: int(raw.impressions) ?? 0,
    reach: int(raw.reach),
    frequency: num(raw.frequency),
    clicks: int(raw.clicks),
    linkClicks: int(raw.inline_link_clicks),
    leads: leadsFromActions(raw.actions),
  };
}

/** YYYY-MM-DD arithmetic in UTC (days are labels here, not instants). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** First day Meta still answers for, with one day of margin: today minus 37 months, plus 1 day. */
export function oldestAllowedDay(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - HISTORY_MONTHS);
  return addDays(d.toISOString().slice(0, 10), 1);
}

/** Which days a run reads: everything Meta keeps (FULL) or the recent days (INCREMENTAL). */
export function syncWindow(kind: "FULL" | "INCREMENTAL", today: string): { since: string; until: string } {
  return { since: kind === "FULL" ? oldestAllowedDay(today) : addDays(today, -(RECENT_DAYS - 1)), until: today };
}

/** Splits [since, until] (inclusive) into blocks of at most `size` days, oldest first. */
export function dayChunks(since: string, until: string, size = CHUNK_DAYS): { since: string; until: string }[] {
  const out: { since: string; until: string }[] = [];
  for (let start = since; start <= until; start = addDays(start, size)) {
    const end = addDays(start, size - 1);
    out.push({ since: start, until: end < until ? end : until });
  }
  return out;
}

export type MetaErrorKind = "RATE_LIMIT" | "AUTH" | "PERMISSION" | "OTHER";

/** Groups Meta error codes into what the app does next: wait, ask for a new token, ask for a permission, or report. */
export function classifyMetaError(code: number | null | undefined, subcode?: number | null): MetaErrorKind {
  if (code === undefined || code === null) return "OTHER";
  if ([4, 17, 32, 613].includes(code) || (code >= 80000 && code <= 80014)) return "RATE_LIMIT";
  if (code === 190 || code === 102 || subcode === 463 || subcode === 467) return "AUTH";
  if (code === 10 || (code >= 200 && code <= 299)) return "PERMISSION";
  return "OTHER";
}

type Targeting = {
  age_min?: number;
  age_max?: number;
  geo_locations?: {
    countries?: string[];
    regions?: { name?: string }[];
    cities?: { name?: string; radius?: number; distance_unit?: string }[];
    zips?: { name?: string; key?: string }[];
    custom_locations?: { name?: string; radius?: number; distance_unit?: string; address_string?: string }[];
  };
};

/** Short, human summary of an ad set audience: "Marietta (+35 mi) · 30–65". Null when Meta sends nothing useful. */
export function targetingSummary(t: Targeting | null | undefined): string | null {
  if (!t) return null;
  const g = t.geo_locations ?? {};
  const radius = (r?: number, unit?: string) => (r ? ` (+${r} ${unit === "kilometer" ? "km" : "mi"})` : "");
  const places = [
    ...(g.custom_locations ?? []).map((c) => `${c.name ?? c.address_string ?? "Ponto no mapa"}${radius(c.radius, c.distance_unit)}`),
    ...(g.cities ?? []).map((c) => `${c.name ?? "Cidade"}${radius(c.radius, c.distance_unit)}`),
    ...(g.zips ?? []).map((z) => z.name ?? z.key ?? "CEP"),
    ...(g.regions ?? []).map((r) => r.name ?? "Região"),
    ...(g.countries ?? []),
  ];
  const where = places.length > 3 ? `${places.slice(0, 3).join(", ")} +${places.length - 3}` : places.join(", ");
  const age = t.age_min || t.age_max ? `${t.age_min ?? 18}–${t.age_max ?? "65+"}` : "";
  const text = [where, age].filter(Boolean).join(" · ");
  return text || null;
}

/**
 * Suggests the internal variant for a Meta ad when its name carries exactly one variant code: the full key
 * ("CS-MS-QUALITY-2026-11-A01") or, when it is unique, its short end ("A01"). Null when nothing or more than one
 * matches: the owner decides.
 */
export function suggestVariant<T extends { id: string; adKey: string }>(adName: string | null | undefined, variants: T[]): T | null {
  if (!adName) return null;
  const inName = (code: string) => {
    if (!code) return false;
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^A-Za-z0-9])${escaped}($|[^A-Za-z0-9])`, "i").test(adName);
  };
  const full = variants.filter((v) => inName(v.adKey.trim()));
  if (full.length) return full.length === 1 ? full[0] : null;
  const short = (v: T) => /(?:^|-)([A-Za-z]\d{2,3})$/.exec(v.adKey.trim())?.[1] ?? "";
  const hits = variants.filter((v) => inName(short(v)));
  return hits.length === 1 ? hits[0] : null;
}

/** Meta's effective_status → label and tone for the Gerenciador. */
export function deliveryOf(effectiveStatus: string | null | undefined): { label: string; tone: "ok" | "warn" | "danger" | "neutral"; on: boolean } {
  switch (effectiveStatus) {
    case "ACTIVE":
      return { label: "Ativo", tone: "ok", on: true };
    case "PAUSED":
      return { label: "Desativado", tone: "neutral", on: false };
    case "CAMPAIGN_PAUSED":
      return { label: "Campanha desativada", tone: "neutral", on: false };
    case "ADSET_PAUSED":
      return { label: "Conjunto desativado", tone: "neutral", on: false };
    case "PENDING_REVIEW":
    case "IN_PROCESS":
      return { label: "Em análise", tone: "warn", on: true };
    case "DISAPPROVED":
      return { label: "Reprovado", tone: "danger", on: false };
    case "WITH_ISSUES":
    case "PENDING_BILLING_INFO":
      return { label: "Com problema", tone: "danger", on: true };
    case "ARCHIVED":
      return { label: "Arquivado", tone: "neutral", on: false };
    case "DELETED":
      return { label: "Excluído", tone: "neutral", on: false };
    default:
      return { label: effectiveStatus ? effectiveStatus.toLowerCase() : "Sem status", tone: "neutral", on: false };
  }
}

/** Gerenciador numbers for one row, computed the way Meta does (money in cents). Null = no denominator (UI shows —). */
export function periodMetrics(r: { spendCents: number; impressions: number; clicks: number | null; linkClicks: number | null; leads: number | null }) {
  const per = (a: number, b: number | null) => (b ? Math.round(a / b) : null);
  return {
    costPerResultCents: per(r.spendCents, r.leads),
    cpmCents: r.impressions ? Math.round((r.spendCents / r.impressions) * 1000) : null,
    cpcCents: per(r.spendCents, r.linkClicks),
    ctr: r.impressions && r.clicks !== null ? r.clicks / r.impressions : null,
  };
}
