/**
 * Turns parsed CSCAMP/1 data into normalized records and compares them with what the brand already has,
 * so the preview can show what will be created, updated or left unchanged. Pure: no database access.
 */
import { stripCodeFence } from "./ai-template";
import { parseCscamp, splitList, type Fields, type ParseIssue } from "./cscamp-parser";

const CAMPAIGN_COLUMNS: Record<string, keyof CampaignInput> = {
  CAMPAIGN_KEY: "campaignKey",
  CAMPAIGN_NAME: "name",
  PERSONA: "persona",
  SERVICE: "service",
  OBJECTIVE: "objective",
  TEST_HYPOTHESIS: "hypothesis",
  LANDING_URL: "landingUrl",
  MARKET: "market",
  TEST_VARIABLE: "testVariable",
  CTA_DESTINATION: "ctaDestination",
  NOTES: "notes",
};
const CAMPAIGN_HANDLED = new Set([...Object.keys(CAMPAIGN_COLUMNS), "BRAND", "CHANNELS", "BUDGET_USD_PER_DAY"]);

const AD_COLUMNS: Record<string, keyof AdInput> = {
  AD_KEY: "adKey",
  AD_NAME: "name",
  ANGLE: "angle",
  FORMAT: "format",
  FUNNEL_STAGE: "funnelStage",
  HOOK: "hook",
  PRIMARY_TEXT: "primaryText",
  HEADLINE: "headline",
  DESCRIPTION: "description",
  CTA: "cta",
  VISUAL_DIRECTION: "visualDirection",
  IMAGE_PROMPT: "imagePrompt",
  VIDEO_SCRIPT: "videoScript",
  NOTES: "notes",
  CREATIVE_STATUS: "creativeStatus",
};

export type CampaignInput = {
  campaignKey: string;
  name: string;
  brandName: string;
  persona: string;
  service: string;
  objective: string;
  hypothesis: string;
  channels: string[];
  landingUrl: string;
  market: string | null;
  testVariable: string | null;
  ctaDestination: string | null;
  /** Decimal as string ("25.00"), or null when the file says TBD/blank. */
  budgetPerDay: string | null;
  budgetNote: string | null;
  notes: string | null;
  extra: Record<string, string>;
};

export type AdInput = {
  adKey: string;
  name: string | null;
  angle: string;
  format: string;
  funnelStage: string;
  hook: string;
  primaryText: string;
  headline: string;
  description: string | null;
  cta: string;
  visualDirection: string;
  imagePrompt: string | null;
  videoScript: string | null;
  notes: string | null;
  creativeStatus: string | null;
  extra: Record<string, string>;
};

/** Content fields compared to decide if a variant changed (and needs a new version). */
export const AD_CONTENT_KEYS = [
  "name", "angle", "format", "funnelStage", "hook", "primaryText", "headline", "description",
  "cta", "visualDirection", "imagePrompt", "videoScript", "notes", "creativeStatus",
] as const satisfies readonly (keyof AdInput)[];

export type ExistingVariant = { adKey: string; campaignKey: string } & Pick<AdInput, (typeof AD_CONTENT_KEYS)[number]>;

export type AdChange = "create" | "update" | "unchanged" | "conflict";
export type PlannedAd = { input: AdInput; change: AdChange; changedFields: string[]; warnings: string[] };
export type PlannedCampaign = { input: CampaignInput; exists: boolean; ads: PlannedAd[] };

export type ImportPlan = {
  ok: boolean;
  errors: ParseIssue[];
  warnings: string[];
  campaigns: PlannedCampaign[];
  totals: { campaigns: number; ads: number; create: number; update: number; unchanged: number };
};

export function buildImportPlan(args: {
  text: string;
  brandName: string;
  forbiddenTerms: string[];
  existingCampaignKeys: string[];
  existingVariants: ExistingVariant[];
}): ImportPlan {
  // AIs often wrap the answer in a ``` code block: accept it.
  const parsed = parseCscamp(stripCodeFence(args.text));
  const errors = [...parsed.errors];
  const warnings: string[] = [];
  const existingCampaigns = new Set(args.existingCampaignKeys);
  const existingByKey = new Map(args.existingVariants.map((v) => [v.adKey, v]));

  const campaigns: PlannedCampaign[] = parsed.campaigns.map((pc) => {
    const input = toCampaignInput(pc.fields);
    if (input.brandName && normalize(input.brandName) !== normalize(args.brandName)) {
      warnings.push(
        `Campanha ${input.campaignKey}: BRAND "${input.brandName}" é diferente da marca selecionada "${args.brandName}". Ela será importada na marca selecionada.`,
      );
    }
    const ads = pc.ads.map((pa): PlannedAd => {
      const ad = toAdInput(pa.fields);
      const adWarnings = findForbiddenTerms(ad, args.forbiddenTerms);
      const existing = existingByKey.get(ad.adKey);
      if (!existing) return { input: ad, change: "create", changedFields: [], warnings: adWarnings };
      if (existing.campaignKey !== input.campaignKey) {
        errors.push({
          line: pa.line,
          message: `AD_KEY ${ad.adKey} já existe nesta marca na campanha ${existing.campaignKey}. Use outro AD_KEY.`,
        });
        return { input: ad, change: "conflict", changedFields: [], warnings: adWarnings };
      }
      const changedFields = AD_CONTENT_KEYS.filter((k) => (existing[k] ?? null) !== (ad[k] ?? null));
      return { input: ad, change: changedFields.length ? "update" : "unchanged", changedFields, warnings: adWarnings };
    });
    return { input, exists: existingCampaigns.has(input.campaignKey), ads };
  });

  const allAds = campaigns.flatMap((c) => c.ads);
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    campaigns,
    totals: {
      campaigns: campaigns.length,
      ads: allAds.length,
      create: allAds.filter((a) => a.change === "create").length,
      update: allAds.filter((a) => a.change === "update").length,
      unchanged: allAds.filter((a) => a.change === "unchanged").length,
    },
  };
}

function toCampaignInput(f: Fields): CampaignInput {
  const get = (k: string) => f[k]?.trim() || null;
  const budget = parseBudget(get("BUDGET_USD_PER_DAY"));
  return {
    campaignKey: get("CAMPAIGN_KEY") ?? "",
    name: get("CAMPAIGN_NAME") ?? get("CAMPAIGN_KEY") ?? "",
    brandName: get("BRAND") ?? "",
    persona: get("PERSONA") ?? "",
    service: get("SERVICE") ?? "",
    objective: get("OBJECTIVE") ?? "",
    hypothesis: get("TEST_HYPOTHESIS") ?? "",
    channels: splitList(f.CHANNELS),
    landingUrl: get("LANDING_URL") ?? "",
    market: get("MARKET"),
    testVariable: get("TEST_VARIABLE"),
    ctaDestination: get("CTA_DESTINATION"),
    budgetPerDay: budget.amount,
    budgetNote: budget.note,
    notes: get("NOTES"),
    extra: pickExtra(f, CAMPAIGN_HANDLED),
  };
}

function toAdInput(f: Fields): AdInput {
  const get = (k: string) => f[k]?.trim() || null;
  return {
    adKey: get("AD_KEY") ?? "",
    name: get("AD_NAME"),
    angle: get("ANGLE") ?? "",
    format: get("FORMAT") ?? "",
    funnelStage: get("FUNNEL_STAGE") ?? "",
    hook: get("HOOK") ?? "",
    primaryText: get("PRIMARY_TEXT") ?? "",
    headline: get("HEADLINE") ?? "",
    description: get("DESCRIPTION"),
    cta: get("CTA") ?? "",
    visualDirection: get("VISUAL_DIRECTION") ?? "",
    imagePrompt: get("IMAGE_PROMPT"),
    videoScript: get("VIDEO_SCRIPT"),
    notes: get("NOTES"),
    creativeStatus: get("CREATIVE_STATUS"),
    extra: pickExtra(f, new Set(Object.keys(AD_COLUMNS))),
  };
}

function pickExtra(f: Fields, handled: Set<string>): Record<string, string> {
  return Object.fromEntries(Object.entries(f).filter(([k]) => !handled.has(k)));
}

/** "25", "25.50", "$25" → "25.00"; "TBD"/blank → null with the original text kept as a note. */
export function parseBudget(value: string | null): { amount: string | null; note: string | null } {
  if (!value) return { amount: null, note: null };
  const cleaned = value.replace(/[$,\s]/g, "");
  if (/^\d+(\.\d{1,2})?$/.test(cleaned)) return { amount: Number(cleaned).toFixed(2), note: null };
  return { amount: null, note: value };
}

/** Customer-facing text that mentions a term the brand forbids (case-insensitive). */
export function findForbiddenTerms(ad: AdInput, terms: string[]): string[] {
  const text = [ad.hook, ad.primaryText, ad.headline, ad.description, ad.videoScript, ad.cta]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return terms
    .map((t) => t.trim())
    .filter((t) => t && text.includes(t.toLowerCase()))
    .map((t) => `${ad.adKey}: texto contém "${t}", termo proibido para esta marca.`);
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}
