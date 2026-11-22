/**
 * Parser for the CSCAMP/1 text format (see context/reference/01_ESPECIFICACAO_PARA_CLAUDE.md §3).
 * Pure function, no dependencies. Based on context/reference/04_PARSER_REFERENCIA.ts, extended to
 * accept several CAMPAIGN blocks per file. Values are plain text: never render them as HTML.
 */

export const MAX_IMPORT_BYTES = 2_000_000;
const MAX_FIELD_LENGTH = 20_000;

export const REQUIRED_CAMPAIGN_FIELDS = [
  "CAMPAIGN_KEY", "BRAND", "PERSONA", "SERVICE", "OBJECTIVE",
  "TEST_HYPOTHESIS", "CHANNELS", "LANDING_URL",
] as const;

export const REQUIRED_AD_FIELDS = [
  "AD_KEY", "ANGLE", "FORMAT", "FUNNEL_STAGE", "HOOK",
  "PRIMARY_TEXT", "HEADLINE", "CTA", "VISUAL_DIRECTION",
] as const;

export type Fields = Record<string, string>;
export type ParsedAd = { fields: Fields; line: number };
export type ParsedCampaign = { fields: Fields; ads: ParsedAd[]; line: number };
export type ParseIssue = { line: number; message: string };
export type ParseResult = { campaigns: ParsedCampaign[]; errors: ParseIssue[] };

const KEY_LINE = /^([A-Z][A-Z0-9_]*):\s*(.*)$/;

export function parseCscamp(input: string): ParseResult {
  const errors: ParseIssue[] = [];
  const campaigns: ParsedCampaign[] = [];

  if (input.length > MAX_IMPORT_BYTES) {
    return { campaigns, errors: [{ line: 1, message: "Arquivo muito grande (limite: 2 MB)." }] };
  }

  const lines = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  const first = lines.findIndex((l) => l.trim() && !l.trim().startsWith("#"));
  if (first < 0 || lines[first].trim() !== "CSCAMP/1") {
    return {
      campaigns,
      errors: [{ line: first < 0 ? 1 : first + 1, message: "A primeira linha com conteúdo deve ser CSCAMP/1." }],
    };
  }

  let campaign: ParsedCampaign | null = null;
  let ad: ParsedAd | null = null;
  const adKeys = new Set<string>();
  const campaignKeys = new Set<string>();

  let i = first + 1;
  while (i < lines.length) {
    const line = lines[i].trim();
    const lineNo = i + 1;
    i++;
    if (!line || line.startsWith("#")) continue;

    if (line === "CAMPAIGN") {
      if (campaign) errors.push({ line: lineNo, message: "CAMPAIGN aberto antes de END_CAMPAIGN da campanha anterior." });
      campaign = { fields: {}, ads: [], line: lineNo };
      ad = null;
      continue;
    }
    if (line === "AD") {
      if (!campaign) errors.push({ line: lineNo, message: "AD precisa estar dentro de CAMPAIGN." });
      else if (ad) errors.push({ line: lineNo, message: "AD aberto antes de END_AD do anúncio anterior." });
      else ad = { fields: {}, line: lineNo };
      continue;
    }
    if (line === "END_AD") {
      if (!campaign || !ad) {
        errors.push({ line: lineNo, message: "END_AD sem AD correspondente." });
        continue;
      }
      for (const key of REQUIRED_AD_FIELDS) {
        if (!ad.fields[key]?.trim()) errors.push({ line: ad.line, message: `Anúncio sem campo obrigatório ${key}.` });
      }
      const key = ad.fields.AD_KEY?.trim();
      if (key) {
        if (adKeys.has(key)) errors.push({ line: ad.line, message: `AD_KEY repetido no arquivo: ${key}` });
        adKeys.add(key);
      }
      campaign.ads.push(ad);
      ad = null;
      continue;
    }
    if (line === "END_CAMPAIGN") {
      if (!campaign) {
        errors.push({ line: lineNo, message: "END_CAMPAIGN sem CAMPAIGN correspondente." });
        continue;
      }
      if (ad) {
        errors.push({ line: lineNo, message: "END_CAMPAIGN com anúncio ainda aberto (faltou END_AD)." });
        ad = null;
      }
      closeCampaign(campaign, errors, campaignKeys);
      campaigns.push(campaign);
      campaign = null;
      continue;
    }

    if (!campaign) {
      errors.push({ line: lineNo, message: "Texto fora de uma CAMPAIGN." });
      continue;
    }
    const match = KEY_LINE.exec(line);
    if (!match) {
      errors.push({ line: lineNo, message: "Esperado CAMPO: valor." });
      continue;
    }
    const [, key, rawValue] = match;
    const target = ad ? ad.fields : campaign.fields;
    if (key in target) errors.push({ line: lineNo, message: `Campo repetido: ${key}` });

    let value = rawValue.trim();
    if (value === "<<<") {
      const parts: string[] = [];
      let closed = false;
      while (i < lines.length) {
        if (lines[i].trim() === ">>>") {
          closed = true;
          i++;
          break;
        }
        parts.push(lines[i]);
        i++;
      }
      if (!closed) errors.push({ line: lineNo, message: `Campo ${key}: faltou a linha >>> de fechamento.` });
      value = parts.join("\n").trim();
    }
    if (value.length > MAX_FIELD_LENGTH) {
      errors.push({ line: lineNo, message: `Campo ${key} muito longo (limite ${MAX_FIELD_LENGTH} caracteres).` });
      value = value.slice(0, MAX_FIELD_LENGTH);
    }
    target[key] = value;
  }

  if (ad) errors.push({ line: ad.line, message: "Faltou END_AD." });
  if (campaign) {
    errors.push({ line: campaign.line, message: "Faltou END_CAMPAIGN." });
    closeCampaign(campaign, errors, campaignKeys);
    campaigns.push(campaign);
  }
  if (campaigns.length === 0 && errors.length === 0) {
    errors.push({ line: lines.length, message: "Nenhuma CAMPAIGN encontrada." });
  }
  return { campaigns, errors };
}

function closeCampaign(campaign: ParsedCampaign, errors: ParseIssue[], seen: Set<string>) {
  for (const key of REQUIRED_CAMPAIGN_FIELDS) {
    if (!campaign.fields[key]?.trim()) errors.push({ line: campaign.line, message: `Campanha sem campo obrigatório ${key}.` });
  }
  if (campaign.ads.length === 0) errors.push({ line: campaign.line, message: "Campanha precisa ter pelo menos um AD." });
  const key = campaign.fields.CAMPAIGN_KEY?.trim();
  if (key) {
    if (seen.has(key)) errors.push({ line: campaign.line, message: `CAMPAIGN_KEY repetido no arquivo: ${key}` });
    seen.add(key);
  }
}

/** "META_PAID, FACEBOOK_ORGANIC" → ["META_PAID", "FACEBOOK_ORGANIC"] */
export function splitList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
