/**
 * Ad lifecycle verdict (spec 02): test phase (days 1–3) → live (monitored, no end date) → ended.
 * Pure and deterministic. The verdict is a suggestion only: nothing here touches the ad platform.
 * Boundary rule: thresholds written as "≥" count when equal; those written as ">" or "<" are strict.
 */
import { z } from "zod";
import { formatMoney, formatPercent, type Cents } from "./metrics";
import { daysBetween, type AdSummary } from "./ad-results";

export const decisionRulesSchema = z.object({
  decisionDay: z.number().int().min(1).max(30).default(3),
  minLeadsToPass: z.number().int().min(0).max(1000).default(2),
  minAppointmentsToPass: z.number().int().min(0).max(1000).default(1),
  attentionSpendMultiple: z.number().min(0).max(20).default(1),
  stopSpendMultiple: z.number().min(0).max(20).default(1.5),
  maxFrequency: z.number().min(0).max(50).default(3),
  dailyOverspendTolerancePct: z.number().min(0).max(500).default(25),
  diagMinImpressions: z.number().int().min(0).default(1000),
  diagMinLinkCtr: z.number().min(0).max(1).default(0.01),
  diagMinClicksForConversion: z.number().int().min(0).default(15),
  diagMinLeadsForQuality: z.number().int().min(0).default(2),
});

export type DecisionRules = z.infer<typeof decisionRulesSchema>;

export const DEFAULT_RULES: DecisionRules = decisionRulesSchema.parse({});

/** Stored JSON → rules; unknown or invalid values fall back to the defaults. */
export function parseRules(json: unknown): DecisionRules {
  const parsed = decisionRulesSchema.safeParse(json ?? {});
  return parsed.success ? parsed.data : DEFAULT_RULES;
}

export type Phase = "TESTING" | "LIVE" | "ENDED";

export type Verdict =
  | "NOT_STARTED"
  | "TESTING_DECIDE_DAY_3"
  | "TEST_PASSED_KEEP"
  | "TEST_FAILED_CANCEL"
  | "LIVE_CONTINUE"
  | "LIVE_ATTENTION"
  | "LIVE_STOP"
  | "NO_TARGET"
  | "ENDED";

export type Stage = "NO_MEDIA_DATA" | "DELIVERY" | "ATTENTION" | "CONVERSION" | "LEAD_QUALITY";

export type Alert = "OVERSPEND_DAY" | "BRAND_CAP_EXCEEDED" | "CREATIVE_FATIGUE";

export type Diagnosis = { stage: Stage; hint: string };

export type Evaluation = {
  /** Day of the ad (day 1 = first day with spend), or null before any spend. */
  day: number | null;
  phase: Phase;
  verdict: Verdict;
  reasons: string[];
  diagnosis: Diagnosis | null;
  alerts: Alert[];
};

export type BrandTargets = {
  currency: string;
  adDailyBudgetCents: Cents;
  targetCostPerAppointmentCents: Cents | null;
  maxDailySpendCents: Cents | null;
  /** Ads currently in TESTING or LIVE with spend, used for the brand cap alert. */
  activeAdsCount: number;
};

export type AdState = {
  phase: Phase;
  /** Max daily spend seen on a single day, for the overspend alert. */
  maxDaySpendCents: Cents;
};

/**
 * Where the funnel got stuck, first blocked stage wins. These are hints, not certainties.
 */
export function diagnose(s: AdSummary, rules: DecisionRules, currency: string): Diagnosis | null {
  const t = s.total;
  if (t.impressions === 0) return { stage: "NO_MEDIA_DATA", hint: "Registre as métricas (impressões, cliques) para ver onde travou." };
  if (t.impressions < rules.diagMinImpressions) {
    return { stage: "DELIVERY", hint: `A Meta quase não mostrou (${t.impressions.toLocaleString("en-US")} impressões): público pequeno, orçamento ou anúncio em análise.` };
  }
  if (t.hasClickData && t.linkCtr !== null && t.linkCtr < rules.diagMinLinkCtr) {
    return { stage: "ATTENTION", hint: `As pessoas viram e não clicaram (CTR ${formatPercent(t.linkCtr)}): o gancho/criativo não chamou atenção.` };
  }
  if (t.hasClickData && t.linkClicks >= rules.diagMinClicksForConversion && t.leads === 0) {
    return { stage: "CONVERSION", hint: `Clicaram (${t.linkClicks} cliques) e não deixaram contato: formulário, oferta ou página.` };
  }
  if (t.leads >= rules.diagMinLeadsForQuality && t.appointments === 0) {
    const cpl = t.cpl === null ? "" : ` a ${formatMoney(t.cpl, currency)} cada`;
    return { stage: "LEAD_QUALITY", hint: `Chegaram ${t.leads} leads${cpl} e nenhum virou visita: lead fraco ou atendimento/ligação.` };
  }
  return null;
}

function alertsFor(s: AdSummary, state: AdState, brand: BrandTargets, rules: DecisionRules): Alert[] {
  const alerts: Alert[] = [];
  if (state.phase === "ENDED") return alerts;
  if (s.firstSpendDay !== null && state.maxDaySpendCents > brand.adDailyBudgetCents * (1 + rules.dailyOverspendTolerancePct / 100)) alerts.push("OVERSPEND_DAY");
  if (brand.maxDailySpendCents !== null && brand.activeAdsCount * brand.adDailyBudgetCents > brand.maxDailySpendCents) alerts.push("BRAND_CAP_EXCEEDED");
  if (state.phase === "LIVE" && s.last7.frequency !== null && s.last7.frequency > rules.maxFrequency) alerts.push("CREATIVE_FATIGUE");
  return alerts;
}

/** Evaluates one ad for `today` (YYYY-MM-DD in the brand timezone). */
export function evaluateAd(s: AdSummary, state: AdState, brand: BrandTargets, rules: DecisionRules, today: string): Evaluation {
  const money = (c: Cents | null) => formatMoney(c, brand.currency);
  const day = s.firstSpendDay === null ? null : daysBetween(s.firstSpendDay, today) + 1;
  const alerts = alertsFor(s, state, brand, rules);
  const t = s.total;
  const base = { day, phase: state.phase, alerts };

  if (state.phase === "ENDED") {
    return { ...base, verdict: "ENDED", reasons: [`Encerrado. Total: gastou ${money(t.spend)}, ${t.leads} leads, ${t.appointments} visitas marcadas.`], diagnosis: t.appointments === 0 ? diagnose(s, rules, brand.currency) : null };
  }

  if (state.phase === "TESTING") {
    if (day === null) return { ...base, verdict: "NOT_STARTED", reasons: ["Ainda sem gasto registrado."], diagnosis: null };
    const passed = t.appointments >= rules.minAppointmentsToPass || t.leads >= rules.minLeadsToPass;
    const summary = `Dia ${day}: gastou ${money(t.spend)}, ${t.leads} leads, ${t.appointments} visitas marcadas.`;
    if (day < rules.decisionDay) {
      return { ...base, verdict: "TESTING_DECIDE_DAY_3", reasons: [summary, `Decidir no dia ${rules.decisionDay}.`], diagnosis: passed ? null : diagnose(s, rules, brand.currency) };
    }
    if (passed) {
      return { ...base, verdict: "TEST_PASSED_KEEP", reasons: [summary, `Passou no teste (meta: ${rules.minAppointmentsToPass} visita ou ${rules.minLeadsToPass} leads). Deixe vivo e monitore.`], diagnosis: null };
    }
    return { ...base, verdict: "TEST_FAILED_CANCEL", reasons: [summary, `Não deu resultado até o dia ${rules.decisionDay}. Cancele e veja o que aconteceu.`], diagnosis: diagnose(s, rules, brand.currency) };
  }

  // LIVE
  const target = brand.targetCostPerAppointmentCents;
  if (target === null) return { ...base, verdict: "NO_TARGET", reasons: ["Defina o custo máximo por visita na marca para monitorar este anúncio."], diagnosis: null };
  const since = s.spendSinceLastAppointment;
  const sinceText = s.lastAppointmentDay ? `desde a última visita (${s.lastAppointmentDay})` : "desde que ficou vivo, sem nenhuma visita";
  if (since >= target * rules.stopSpendMultiple) {
    return { ...base, verdict: "LIVE_STOP", reasons: [`Gastou ${money(since)} ${sinceText}: passou de ${money(Math.round(target * rules.stopSpendMultiple))} (${rules.stopSpendMultiple}× a meta de ${money(target)}).`, "Parou de compensar. Pare e veja o que aconteceu."], diagnosis: diagnose(s, rules, brand.currency) };
  }
  const cpv7 = s.last7.costPerAppointment;
  if (since >= target * rules.attentionSpendMultiple) {
    return { ...base, verdict: "LIVE_ATTENTION", reasons: [`Gastou ${money(since)} ${sinceText} (meta por visita: ${money(target)}).`, `Para em ${money(Math.round(target * rules.stopSpendMultiple))} sem visita nova.`], diagnosis: null };
  }
  if (cpv7 !== null && cpv7 > target) {
    return { ...base, verdict: "LIVE_ATTENTION", reasons: [`Custo por visita dos últimos 7 dias: ${money(cpv7)}, acima da meta de ${money(target)}.`], diagnosis: null };
  }
  const cpvText = cpv7 !== null ? `custo por visita nos últimos 7 dias ${money(cpv7)}` : `gastou ${money(since)} ${sinceText}`;
  return { ...base, verdict: "LIVE_CONTINUE", reasons: [`Está compensando: ${cpvText} (meta ${money(target)}).`], diagnosis: null };
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  NOT_STARTED: "Aguardando início",
  TESTING_DECIDE_DAY_3: "Em teste",
  TEST_PASSED_KEEP: "Passou no teste: deixar vivo",
  TEST_FAILED_CANCEL: "Não deu resultado: cancelar",
  LIVE_CONTINUE: "Continuar: está compensando",
  LIVE_ATTENTION: "Atenção",
  LIVE_STOP: "Parar: deixou de compensar",
  NO_TARGET: "Sem meta",
  ENDED: "Encerrado",
};

export const ALERT_LABEL: Record<Alert, string> = {
  OVERSPEND_DAY: "Algum dia gastou acima do orçamento planejado",
  BRAND_CAP_EXCEEDED: "Anúncios ativos passam do gasto máximo por dia da marca",
  CREATIVE_FATIGUE: "Criativo cansando (frequência alta): prepare um criativo novo para este ângulo",
};

export const STAGE_LABEL: Record<Stage, string> = {
  NO_MEDIA_DATA: "Sem métricas",
  DELIVERY: "Entrega",
  ATTENTION: "Atenção (clique)",
  CONVERSION: "Conversão (contato)",
  LEAD_QUALITY: "Lead → visita",
};

/** Verdicts that need the owner to act today. */
export const NEEDS_ACTION: Verdict[] = ["TEST_PASSED_KEEP", "TEST_FAILED_CANCEL", "LIVE_STOP", "LIVE_ATTENTION"];
