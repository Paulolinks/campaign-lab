/**
 * Brand-level view of the ad tests (spec 02): what to do today and the score per angle.
 * Pure: receives evaluated ads.
 */
import type { Evaluation } from "./ad-decision";
import { costPer, type Cents } from "./metrics";

export type EvaluatedAd = {
  angle: string | null;
  phase: Evaluation["phase"];
  evaluation: Evaluation;
  /** Ever chosen "keep live" (passed the test). */
  hasPassedTest: boolean;
  isCancelled: boolean;
  spend: Cents;
  appointments: number;
};

export type TodayPlan = { decide: number; stop: number; attention: number; alerts: number; sentence: string };

export function todayPlan(ads: EvaluatedAd[]): TodayPlan {
  const v = (verdicts: string[]) => ads.filter((a) => verdicts.includes(a.evaluation.verdict)).length;
  const keep = v(["TEST_PASSED_KEEP"]);
  const cancel = v(["TEST_FAILED_CANCEL"]);
  const stop = v(["LIVE_STOP"]);
  const attention = v(["LIVE_ATTENTION"]);
  const alerts = ads.filter((a) => a.evaluation.alerts.length > 0).length;
  const live = ads.filter((a) => a.phase === "LIVE").length;
  const testing = ads.filter((a) => a.phase === "TESTING").length;

  const parts: string[] = [];
  if (cancel > 0) parts.push(`cancelar ${cancel} teste${cancel > 1 ? "s" : ""} sem resultado e ver o que aconteceu`);
  if (keep > 0) parts.push(`deixar vivo${keep > 1 ? "s" : ""} ${keep} que passou${keep > 1 ? "aram" : ""} no teste`);
  if (stop > 0) parts.push(`parar ${stop} anúncio${stop > 1 ? "s" : ""} que deixou${stop > 1 ? "aram" : ""} de compensar`);
  if (attention > 0) parts.push(`olhar de perto ${attention} em atenção`);
  if (cancel + stop > 0) parts.push("preparar um anúncio novo para o lugar");
  if (alerts > 0) parts.push(`conferir ${alerts} alerta${alerts > 1 ? "s" : ""}`);

  let sentence: string;
  if (parts.length > 0) sentence = `Hoje: ${parts.join("; ")}.`;
  else if (live + testing === 0) sentence = "Nenhum anúncio rodando. Crie e publique um anúncio novo para testar.";
  else sentence = `Nada para decidir hoje: ${testing} em teste e ${live} vivo${live === 1 ? "" : "s"}. Registre as métricas do dia.`;

  return { decide: keep + cancel, stop, attention, alerts, sentence };
}

export type AngleScore = { angle: string; ads: number; passed: number; cancelled: number; spend: Cents; appointments: number; costPerAppointment: Cents | null };

/** Score per angle: how many ads passed the test, were cancelled, and cost per visit. */
export function scoreByAngle(ads: EvaluatedAd[]): AngleScore[] {
  const byAngle = new Map<string, EvaluatedAd[]>();
  for (const a of ads) {
    const key = a.angle ?? "Sem ângulo";
    byAngle.set(key, [...(byAngle.get(key) ?? []), a]);
  }
  return [...byAngle.entries()]
    .map(([angle, list]) => {
      const spend = list.reduce((s, a) => s + a.spend, 0);
      const appointments = list.reduce((s, a) => s + a.appointments, 0);
      return {
        angle,
        ads: list.length,
        passed: list.filter((a) => a.hasPassedTest).length,
        cancelled: list.filter((a) => a.isCancelled).length,
        spend,
        appointments,
        costPerAppointment: costPer(spend, appointments),
      };
    })
    .sort((a, b) => (a.costPerAppointment ?? Infinity) - (b.costPerAppointment ?? Infinity) || b.passed - a.passed);
}
