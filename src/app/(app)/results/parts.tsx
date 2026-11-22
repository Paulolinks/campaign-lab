import { ALERT_LABEL, STAGE_LABEL, VERDICT_LABEL, type Evaluation, type Verdict } from "@/domain/ad-decision";
import type { Totals } from "@/domain/ad-results";
import { formatMoney, formatPercent } from "@/domain/metrics";
import { Pill, type PillTone } from "../../ui";

const VERDICT_TONE: Record<Verdict, PillTone> = {
  NOT_STARTED: "neutral",
  TESTING_DECIDE_DAY_3: "neutral",
  TEST_PASSED_KEEP: "ok",
  TEST_FAILED_CANCEL: "danger",
  LIVE_CONTINUE: "ok",
  LIVE_ATTENTION: "warn",
  LIVE_STOP: "danger",
  NO_TARGET: "warn",
  ENDED: "neutral",
};

export const PHASE_LABEL = { TESTING: "Em teste", LIVE: "Vivo", ENDED: "Encerrado" } as const;

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  return <Pill tone={VERDICT_TONE[verdict]}>{VERDICT_LABEL[verdict]}</Pill>;
}

export function dayLabel(e: Evaluation) {
  return e.day === null ? "—" : `Dia ${e.day}`;
}

/** A number with a short "what is this" explanation (visible text, not only a tooltip, for mobile). */
function Stat({ label, value, help, big = false }: { label: string; value: string; help: string; big?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3" title={help}>
      <div className="text-[11px] font-semibold text-soft">{label}</div>
      <div className={`mt-1 truncate font-bold tracking-tight ${big ? "text-2xl" : "text-lg"} ${value === "N/D" ? "text-soft" : ""}`}>{value}</div>
      <div className="mt-1 text-[10px] leading-tight text-soft">{help}</div>
    </div>
  );
}

const num = (n: number) => n.toLocaleString("en-US");

/** The 5 numbers that matter, always visible. */
export function KeyNumbers({ t, currency }: { t: Totals; currency: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <Stat big label="Gasto" value={formatMoney(t.spend, currency)} help="Quanto o anúncio gastou." />
      <Stat big label="Leads" value={num(t.leads)} help={t.platformLeads > t.crmLeads ? `Contagem da Meta (${t.crmLeads} no CRM).` : "Contatos que chegaram."} />
      <Stat big label="Visitas marcadas" value={num(t.appointments)} help="Leads que marcaram visita em casa." />
      <Stat big label="Custo por visita" value={formatMoney(t.costPerAppointment, currency)} help="Gasto ÷ visitas marcadas. A métrica principal." />
      <Stat big label="Contratos" value={t.won === 0 ? "0" : `${t.won} · ${formatMoney(t.revenue, currency)}`} help="Vendas fechadas e receita." />
    </div>
  );
}

/** Same names as Meta Ads Manager; collapsed by default. */
export function MetaNumbers({ t, currency }: { t: Totals; currency: string }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-semibold text-soft">Números da Meta</summary>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Impressões" value={t.impressions === 0 ? "N/D" : num(t.impressions)} help="Vezes que o anúncio apareceu." />
        <Stat label="Alcance" value={t.reach === null ? "N/D" : num(t.reach)} help="Pessoas diferentes (soma dos dias, aprox.)." />
        <Stat label="Frequência" value={t.frequency === null ? "N/D" : t.frequency.toFixed(2)} help="Vezes que cada pessoa viu (aprox.)." />
        <Stat label="CTR (link)" value={formatPercent(t.linkCtr)} help="% de quem viu e clicou." />
        <Stat label="CPC (link)" value={formatMoney(t.linkCpc, currency)} help="Custo por clique no link." />
        <Stat label="CPM" value={formatMoney(t.cpm, currency)} help="Custo por mil impressões." />
        <Stat label="Custo por lead" value={formatMoney(t.cpl, currency)} help="Gasto ÷ leads." />
      </div>
    </details>
  );
}

/** Only shown when there is an estimate or a contract. */
export function MoneyNumbers({ t, currency }: { t: Totals; currency: string }) {
  if (t.estimatesSent === 0 && t.won === 0) return null;
  const margin = t.revenue === 0 ? null : (t.revenue - t.directCosts) / t.revenue;
  const roas = t.spend === 0 ? null : t.revenue / t.spend;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="Orçamentos enviados" value={num(t.estimatesSent)} help="Propostas mandadas." />
      <Stat label="Receita" value={formatMoney(t.revenue, currency)} help="Valor dos contratos." />
      <Stat label="Margem" value={formatPercent(margin)} help="(Receita − custos diretos) ÷ receita." />
      <Stat label="ROAS" value={roas === null ? "N/D" : `${roas.toFixed(2)}x`} help="Receita ÷ gasto em anúncio." />
    </div>
  );
}

export function EvaluationBox({ e }: { e: Evaluation }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <ul className="list-disc pl-5">
        {e.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {e.diagnosis && (
        <div className="rounded-[9px] border border-[#5d4a2c] bg-[#3d3022] px-3 py-2 text-xs text-warn">
          <strong>O que aconteceu (pista) · {STAGE_LABEL[e.diagnosis.stage]}:</strong> {e.diagnosis.hint}
        </div>
      )}
      {e.alerts.map((a) => (
        <div key={a} className="rounded-[9px] border border-[#6b2f2f] bg-[#3a1d1d] px-3 py-2 text-xs text-danger">
          ⚠ {ALERT_LABEL[a]}
        </div>
      ))}
    </div>
  );
}
