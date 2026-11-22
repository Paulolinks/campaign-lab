import Link from "next/link";
import { NEEDS_ACTION } from "@/domain/ad-decision";
import { scoreByAngle, todayPlan, type EvaluatedAd } from "@/domain/ad-today";
import { formatMoney } from "@/domain/metrics";
import { loadAdResults, type AdResult } from "@/lib/ad-results-service";
import { requireBrand } from "@/lib/session";
import { Empty, LinkButton, PageHeader, Panel, Pill, Table } from "../../ui";
import { dayLabel, VerdictPill } from "./parts";

const GROUPS = [
  { phase: "TESTING", title: "Em teste" },
  { phase: "LIVE", title: "Vivos" },
  { phase: "ENDED", title: "Encerrados" },
] as const;

function toEvaluated(r: AdResult): EvaluatedAd {
  return {
    angle: r.ad.variant?.angle ?? null,
    phase: r.ad.lifecycle,
    evaluation: r.evaluation,
    hasPassedTest: r.ad.decisions.some((d) => d.action === "KEEP_LIVE"),
    isCancelled: r.ad.decisions.some((d) => d.action === "CANCEL"),
    spend: r.summary.total.spend,
    appointments: r.summary.total.appointments,
  };
}

export default async function ResultsPage() {
  const { brand } = await requireBrand();
  const { ads, targets } = await loadAdResults(brand.id);
  const cur = targets.currency;
  const evaluated = ads.map(toEvaluated);
  const plan = todayPlan(evaluated);
  const scores = scoreByAngle(evaluated);
  const urgent = ads.filter((a) => NEEDS_ACTION.includes(a.evaluation.verdict) || a.evaluation.alerts.length > 0);

  return (
    <>
      <PageHeader
        eyebrow={brand.name}
        title="Resultados dos anúncios"
        subtitle="Cada anúncio: teste até o dia 3 → vivo enquanto compensar → encerrado. O app sugere, você decide."
        actions={<LinkButton href={`/brands/${brand.id}`}>Metas da marca</LinkButton>}
      />

      {targets.targetCostPerAppointmentCents === null && (
        <div className="mb-4 rounded-[9px] border border-[#635037] bg-[#34301f] px-4 py-3 text-xs text-[#ffdc9f]">
          Defina o <strong>custo máximo por visita marcada</strong> em <Link className="underline" href={`/brands/${brand.id}`}>Metas da marca</Link> para monitorar os anúncios vivos.
        </div>
      )}

      <Panel title="O que fazer hoje">
        <p className="text-sm">{plan.sentence}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone={plan.decide ? "warn" : "neutral"}>Decidir hoje: {plan.decide}</Pill>
          <Pill tone={plan.stop ? "danger" : "neutral"}>Parar: {plan.stop}</Pill>
          <Pill tone={plan.attention ? "warn" : "neutral"}>Atenção: {plan.attention}</Pill>
          <Pill tone={plan.alerts ? "danger" : "neutral"}>Alertas: {plan.alerts}</Pill>
        </div>
        {urgent.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {urgent.map((a) => (
              <li key={a.ad.id}>
                <Link className="text-accent hover:underline" href={`/published/${a.ad.id}`}>{a.ad.name ?? a.ad.variant?.adKey ?? a.ad.externalAdId}</Link>{" "}
                <VerdictPill verdict={a.evaluation.verdict} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {ads.length === 0 ? (
        <div className="mt-4">
          <Empty action={<LinkButton href="/published" variant="primary">Cadastrar anúncio publicado</LinkButton>}>Nenhum anúncio publicado ainda.</Empty>
        </div>
      ) : (
        GROUPS.map((g) => {
          const list = ads.filter((a) => a.ad.lifecycle === g.phase);
          if (list.length === 0) return null;
          return (
            <Panel key={g.phase} className="mt-4" title={`${g.title} (${list.length})`}>
              <Table head={["Anúncio", "Veredito", "Dia", "Gasto", "Leads", "Visitas", "Custo por visita"]}>
                {list.map((a) => {
                  const t = a.summary.total;
                  return (
                    <tr key={a.ad.id}>
                      <td className="max-w-[220px]">
                        <Link className="break-all font-semibold text-accent hover:underline" href={`/published/${a.ad.id}`}>{a.ad.name ?? a.ad.variant?.adKey ?? a.ad.externalAdId}</Link>
                        {a.ad.variant && <div className="text-[11px] text-soft">{a.ad.variant.angle}</div>}
                      </td>
                      <td><VerdictPill verdict={a.evaluation.verdict} /></td>
                      <td>{dayLabel(a.evaluation)}</td>
                      <td>{formatMoney(t.spend, cur)}</td>
                      <td>{t.leads}</td>
                      <td>{t.appointments}</td>
                      <td className={t.costPerAppointment === null ? "text-soft" : ""}>{formatMoney(t.costPerAppointment, cur)}</td>
                    </tr>
                  );
                })}
              </Table>
            </Panel>
          );
        })
      )}

      {scores.length > 0 && (
        <Panel className="mt-4" title="Placar por ângulo" aside="Do mais barato por visita ao mais caro">
          <Table head={["Ângulo", "Anúncios", "Passaram no teste", "Cancelados", "Gasto", "Visitas", "Custo por visita"]}>
            {scores.map((s) => (
              <tr key={s.angle}>
                <td className="font-semibold">{s.angle}</td>
                <td>{s.ads}</td>
                <td>{s.passed}</td>
                <td>{s.cancelled}</td>
                <td>{formatMoney(s.spend, cur)}</td>
                <td>{s.appointments}</td>
                <td className={s.costPerAppointment === null ? "text-soft" : ""}>{formatMoney(s.costPerAppointment, cur)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
    </>
  );
}
