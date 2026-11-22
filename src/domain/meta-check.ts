/**
 * Pure helpers for checking a Meta (Facebook/Instagram) connection: which settings are missing,
 * which permissions the token lacks, and what the ad account status means. No network here.
 */

/** Permissions the app will need, in the order the features use them. */
export const META_PERMISSIONS = [
  { name: "ads_read", use: "Ler gasto, cliques e leads de cada anúncio" },
  { name: "ads_management", use: "Criar anúncios pausados e pausar" },
  { name: "business_management", use: "Ver a conta de anúncios e a página do Business" },
  { name: "leads_retrieval", use: "Puxar os leads dos formulários" },
  { name: "pages_show_list", use: "Achar a página" },
  { name: "pages_read_engagement", use: "Ler a página" },
  { name: "pages_manage_metadata", use: "Receber lead na hora (webhook)" },
  { name: "pages_manage_ads", use: "Criar formulários e anúncios da página" },
] as const;

/** Accepts "123", "act_123" or with spaces; returns "act_123", or null when it is not a number. */
export function normalizeAdAccountId(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").trim().replace(/^act_/i, "");
  return /^\d{5,25}$/.test(digits) ? `act_${digits}` : null;
}

/** Graph API /me/permissions answer → which of our permissions are granted and which are missing. */
export function checkPermissions(data: { permission: string; status: string }[]) {
  const granted = new Set(data.filter((p) => p.status === "granted").map((p) => p.permission));
  return {
    granted: META_PERMISSIONS.filter((p) => granted.has(p.name)).map((p) => p.name),
    missing: META_PERMISSIONS.filter((p) => !granted.has(p.name)).map((p) => p.name),
  };
}

const ACCOUNT_STATUS: Record<number, { label: string; ok: boolean }> = {
  1: { label: "Ativa", ok: true },
  2: { label: "Desativada", ok: false },
  3: { label: "Pagamento pendente", ok: false },
  7: { label: "Em análise de risco", ok: false },
  8: { label: "Acerto pendente", ok: false },
  9: { label: "Período de carência", ok: true },
  100: { label: "Fechamento pendente", ok: false },
  101: { label: "Fechada", ok: false },
};

export function accountStatus(code: number | null | undefined) {
  return ACCOUNT_STATUS[code ?? -1] ?? { label: `Desconhecido (${code ?? "sem código"})`, ok: false };
}

/** Page id: digits only. */
export function normalizePageId(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  return /^\d{5,25}$/.test(v) ? v : null;
}
