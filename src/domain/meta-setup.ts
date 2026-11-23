/**
 * How a planned campaign will be set up in the Meta Ads Manager, read from the optional CSCAMP/1 fields
 * (stored in `extra`). Pure: the pages show it field by field, as the owner would fill it in by hand.
 */

export type SetupRow = { key: string; label: string; value: string };

const CAMPAIGN_FIELDS: [key: string, label: string][] = [
  ["META_CAMPAIGN_NAME", "Nome da campanha"],
  ["META_OBJECTIVE", "Objetivo"],
  ["META_SPECIAL_CATEGORY", "Categoria especial de anúncio"],
  ["META_BUDGET_MODE", "Onde fica o orçamento"],
  ["META_BID_STRATEGY", "Estratégia de lance"],
  ["META_AB_TEST", "Teste A/B"],
  ["META_STATUS", "Status ao criar"],
];

const ADSET_FIELDS: [key: string, label: string][] = [
  ["ADSET_NAME", "Nome do conjunto"],
  ["ADSET_CONVERSION_LOCATION", "Local da conversão"],
  ["ADSET_OPTIMIZATION", "Meta de desempenho"],
  ["ADSET_BUDGET_USD_PER_DAY", "Orçamento por dia (US$)"],
  ["ADSET_SCHEDULE", "Programação"],
  ["ADSET_LOCATION", "Localização"],
  ["ADSET_AGE", "Idade"],
  ["ADSET_GENDER", "Gênero"],
  ["ADSET_AUDIENCE", "Público"],
  ["ADSET_PLACEMENTS", "Posicionamentos"],
  ["ADSET_LANGUAGE", "Idioma"],
];

const AD_FIELDS: [key: string, label: string][] = [
  ["AD_IDENTITY", "Identidade (página e Instagram)"],
  ["AD_FORMAT_META", "Formato na Meta"],
  ["MEDIA_SPEC", "Mídia: tamanho e tipo"],
  ["FORM_TYPE", "Tipo de formulário"],
  ["FORM_INTRO", "Abertura do formulário"],
  ["FORM_THANKS", "Tela de agradecimento"],
];

/** Lists accept one item per line or items separated by " · " or ";". */
export function listItems(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|\s·\s|;/)
    .map((s) => s.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

function rows(extra: Record<string, string>, fields: [string, string][]): SetupRow[] {
  return fields.flatMap(([key, label]) => {
    const value = extra[key]?.trim();
    return value ? [{ key, label, value }] : [];
  });
}

export function asExtra(json: unknown): Record<string, string> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  return Object.fromEntries(Object.entries(json as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

const DESTINATION: Record<string, string> = {
  META_INSTANT_FORM: "Cadastros (Leads) · formulário instantâneo",
  LANDING_PAGE: "Tráfego / Cadastros no site",
  WEBSITE: "Tráfego / Cadastros no site",
  MESSENGER: "Engajamento · mensagens",
  WHATSAPP: "Engajamento · WhatsApp",
};

/** Campaign level. Fills the objective from the CTA destination when the file does not say it. */
export function campaignSetup(extra: Record<string, string>, ctaDestination: string | null): SetupRow[] {
  const out = rows(extra, CAMPAIGN_FIELDS);
  if (!extra.META_OBJECTIVE && ctaDestination && DESTINATION[ctaDestination]) {
    out.splice(extra.META_CAMPAIGN_NAME ? 1 : 0, 0, { key: "META_OBJECTIVE", label: "Objetivo", value: DESTINATION[ctaDestination] });
  }
  return out;
}

export function adSetSetup(adExtra: Record<string, string>): SetupRow[] {
  return rows(adExtra, ADSET_FIELDS);
}

export function adSetup(adExtra: Record<string, string>): SetupRow[] {
  return rows(adExtra, AD_FIELDS);
}

export const CAMPAIGN_SETUP_KEYS = new Set([...CAMPAIGN_FIELDS.map(([k]) => k), "TASKS"]);
export const AD_SETUP_KEYS = new Set([...ADSET_FIELDS.map(([k]) => k), ...AD_FIELDS.map(([k]) => k), "FORM_QUESTIONS"]);

/** Extra fields not shown by the setup panels (still displayed as generic details). */
export function otherExtra(extra: Record<string, string>, shown: Set<string>): [string, string][] {
  return Object.entries(extra).filter(([k]) => !shown.has(k));
}
