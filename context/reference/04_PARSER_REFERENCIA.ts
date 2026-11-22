/**
 * Parser de referência para o contrato textual CSCAMP/1.
 * Demonstra formato e validações básicas; Claude deve integrar à camada de
 * autenticação, autorização, persistência, Zod e versionamento do projeto.
 * Zero dependências. Uso: parseCampaignTxt(conteudo).
 */
export type ImportedAd = {
  AD_KEY: string;
  AD_NAME?: string;
  ANGLE: string;
  FORMAT: string;
  FUNNEL_STAGE: string;
  HOOK: string;
  PRIMARY_TEXT: string;
  HEADLINE: string;
  CTA: string;
  VISUAL_DIRECTION: string;
  DESCRIPTION?: string;
  IMAGE_PROMPT?: string;
  VIDEO_SCRIPT?: string;
  NOTES?: string;
  [key: string]: string | undefined;
};

export type ImportedCampaign = {
  campaign: Record<string, string>;
  ads: ImportedAd[];
};

export type ImportError = { line: number; message: string };

export type ImportResult =
  | { ok: true; data: ImportedCampaign; errors: [] }
  | { ok: false; data?: ImportedCampaign; errors: ImportError[] };

const REQUIRED_CAMPAIGN = [
  "CAMPAIGN_KEY", "BRAND", "PERSONA", "SERVICE", "OBJECTIVE",
  "TEST_HYPOTHESIS", "CHANNELS", "LANDING_URL",
] as const;
const REQUIRED_AD = [
  "AD_KEY", "ANGLE", "FORMAT", "FUNNEL_STAGE", "HOOK",
  "PRIMARY_TEXT", "HEADLINE", "CTA", "VISUAL_DIRECTION",
] as const;

export function parseCampaignTxt(input: string): ImportResult {
  const errors: ImportError[] = [];
  if (input.length > 2_000_000) {
    return { ok: false, errors: [{ line: 1, message: "Arquivo muito grande (limite: 2 MB)." }] };
  }
  const lines = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const first = lines.findIndex(x => x.trim() && !x.trim().startsWith("#"));
  if (first < 0 || lines[first].trim() !== "CSCAMP/1") {
    return { ok: false, errors: [{ line: first + 1 || 1, message: "Primeira linha significativa deve ser CSCAMP/1." }] };
  }
  type Section = "none" | "campaign" | "ad" | "closed";
  let section: Section = "none";
  let seenCampaign = false;
  let hasEndCampaign = false;
  let currentAd: Record<string, string> | null = null;
  const campaign: Record<string, string> = {};
  const ads: ImportedAd[] = [];
  const keys = new Set<string>();

  let i = first + 1;
  while (i < lines.length) {
    const line = lines[i].trim();
    const lineNo = i + 1;
    i++;
    if (!line || line.startsWith("#")) continue;
    if (line === "CAMPAIGN") {
      if (section !== "none" || seenCampaign) errors.push({ line: lineNo, message: "CAMPAIGN fora de ordem." });
      else { section = "campaign"; seenCampaign = true; }
      continue;
    }
    if (line === "AD") {
      if (section !== "campaign") errors.push({ line: lineNo, message: "AD deve estar dentro de CAMPAIGN, depois de END_AD anterior." });
      else { section = "ad"; currentAd = {}; }
      continue;
    }
    if (line === "END_AD") {
      if (section !== "ad" || currentAd === null) { errors.push({ line: lineNo, message: "END_AD sem AD." }); continue; }
      for (const key of REQUIRED_AD) if (!currentAd[key]?.trim()) errors.push({ line: lineNo, message: `Anúncio sem campo obrigatório ${key}.` });
      const key = currentAd.AD_KEY?.trim();
      if (key && keys.has(key)) errors.push({ line: lineNo, message: `AD_KEY duplicado: ${key}` });
      if (key) keys.add(key);
      ads.push(currentAd as ImportedAd);
      currentAd = null;
      section = "campaign";
      continue;
    }
    if (line === "END_CAMPAIGN") {
      if (section !== "campaign") errors.push({ line: lineNo, message: "END_CAMPAIGN inválido ou anúncio aberto." });
      else { section = "closed"; hasEndCampaign = true; }
      continue;
    }
    if (section === "closed") { errors.push({ line: lineNo, message: "Texto inesperado após END_CAMPAIGN." }); continue; }
    if (section !== "campaign" && section !== "ad") { errors.push({ line: lineNo, message: "Texto fora de seção." }); continue; }
    const match = /^([A-Z][A-Z0-9_]*):\s*(.*)$/.exec(line);
    if (!match) { errors.push({ line: lineNo, message: "Esperado CAMPO: valor." }); continue; }
    const [, key, rawVal] = match;
    const target = (section === "ad" ? currentAd : campaign)!;
    if (key in target) errors.push({ line: lineNo, message: `Campo repetido: ${key}` });
    let value = rawVal;
    if (rawVal === "<<<") {
      const parts: string[] = [];
      let terminated = false;
      while (i < lines.length) {
        if (lines[i].trim() === ">>>") { terminated = true; i++; break; }
        parts.push(lines[i]); i++;
      }
      if (!terminated) errors.push({ line: lineNo, message: `Campo ${key}: faltou >>> de fechamento.` });
      value = parts.join("\n").trim();
    }
    target[key] = value;
  }
  if (!hasEndCampaign) errors.push({ line: lines.length, message: "Faltou END_CAMPAIGN." });
  for (const key of REQUIRED_CAMPAIGN) if (!campaign[key]?.trim()) errors.push({ line: lines.length, message: `Campanha sem campo obrigatório ${key}.` });
  if (ads.length === 0) errors.push({ line: lines.length, message: "Campanha precisa conter pelo menos um AD." });
  const data: ImportedCampaign = { campaign, ads };
  return errors.length ? { ok: false, data, errors } : { ok: true, data, errors: [] };
}
