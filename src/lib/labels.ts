import type { PillTone } from "@/app/ui";

export const PLAN_STATUS: Record<string, { label: string; tone: PillTone }> = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  READY: { label: "Pronto", tone: "ok" },
  TESTING: { label: "Testando", tone: "warn" },
  PAUSED: { label: "Pausado", tone: "neutral" },
  ARCHIVED: { label: "Arquivado", tone: "neutral" },
};

export const APPROVAL: Record<string, { label: string; tone: PillTone }> = {
  PENDING: { label: "Aguardando aprovação", tone: "warn" },
  APPROVED: { label: "Aprovado", tone: "ok" },
  REJECTED: { label: "Rejeitado", tone: "danger" },
};

export const TEST_LABEL: Record<string, { label: string; tone: PillTone }> = {
  TESTING: { label: "TESTANDO", tone: "warn" },
  INSUFFICIENT_DATA: { label: "DADOS INSUFICIENTES", tone: "neutral" },
  BEST_QUALITY_PROVISIONAL: { label: "MELHOR QUALIDADE (PROVISÓRIO)", tone: "ok" },
  PAUSED: { label: "PAUSADO", tone: "neutral" },
  ARCHIVED: { label: "ARQUIVADO", tone: "neutral" },
};

export const LEAD_STATUS: Record<string, { label: string; tone: PillTone }> = {
  NEW: { label: "Novo", tone: "neutral" },
  CONTACTED: { label: "Contatado", tone: "neutral" },
  QUALIFIED: { label: "Qualificado", tone: "ok" },
  DISQUALIFIED: { label: "Desqualificado", tone: "danger" },
  APPOINTMENT_SCHEDULED: { label: "Visita marcada", tone: "warn" },
  APPOINTMENT_COMPLETED: { label: "Visita feita", tone: "warn" },
  ESTIMATE_SENT: { label: "Orçamento enviado", tone: "warn" },
  WON: { label: "Ganho", tone: "ok" },
  LOST: { label: "Perdido", tone: "danger" },
};

export const PLATFORM: Record<string, string> = {
  META: "Meta Ads (Facebook/Instagram)",
  FACEBOOK_ORGANIC: "Facebook orgânico",
  INSTAGRAM_ORGANIC: "Instagram orgânico",
  GOOGLE_ADS: "Google Ads",
  GOOGLE_BUSINESS_PROFILE: "Google Business Profile",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  NEXTDOOR: "Nextdoor",
  MARKETPLACE: "Marketplace (manual)",
  WEBSITE: "Site",
  OTHER: "Outro",
};

export const CONNECTION: Record<string, { label: string; tone: PillTone }> = {
  DISCONNECTED: { label: "Desconectado", tone: "neutral" },
  CONFIGURING: { label: "Em configuração", tone: "warn" },
  CONNECTED: { label: "Conectado", tone: "ok" },
  ERROR: { label: "Erro", tone: "danger" },
};

export const CONFIDENCE: Record<string, string> = {
  CONFIRMED: "Confirmada",
  PROBABLE: "Provável",
  UNKNOWN: "Desconhecida",
};

export const ESTIMATE_STATUS: Record<string, string> = {
  DRAFT: "Rascunho",
  SENT: "Enviado",
  ACCEPTED: "Aceito",
  REJECTED: "Recusado",
};

export const UPLOAD_STATUS: Record<string, { label: string; tone: PillTone }> = {
  STORED: { label: "No servidor", tone: "neutral" },
  UPLOAD_PENDING: { label: "Envio ao Drive pendente", tone: "warn" },
  SYNCED: { label: "No Google Drive", tone: "ok" },
  FAILED: { label: "Falha no envio", tone: "danger" },
};

export function options(map: Record<string, string | { label: string }>) {
  return Object.entries(map).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label }));
}

export function humanize(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "—";
}

export function formatDate(d: Date | null | undefined, timeZone = "America/New_York") {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone }).format(d);
}
