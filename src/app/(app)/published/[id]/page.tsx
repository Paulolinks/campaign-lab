import Link from "next/link";
import { notFound } from "next/navigation";
import { VERDICT_LABEL, type Verdict } from "@/domain/ad-decision";
import { dayInZone, daysBetween } from "@/domain/ad-results";
import { loadAdResults } from "@/lib/ad-results-service";
import { PLATFORM } from "@/lib/labels";
import { requireBrand } from "@/lib/session";
import { ActionForm } from "../../../action-form";
import { Button, Detail, LinkButton, PageHeader, Panel, Pill, Select, TextArea } from "../../../ui";
import { dayLabel, EvaluationBox, KeyNumbers, MetaNumbers, MoneyNumbers, PHASE_LABEL, VerdictPill } from "../../results/parts";
import { recordDecision } from "../actions";

const ACTION_LABEL = { KEEP_LIVE: "Manter vivo", CANCEL: "Cancelar", STOP: "Parar" } as const;
const OPTIONS = {
  TESTING: [
    { value: "KEEP_LIVE", label: "Manter vivo (passou no teste)" },
    { value: "CANCEL", label: "Cancelar (não deu resultado)" },
  ],
  LIVE: [{ value: "STOP", label: "Parar (deixou de compensar)" }],
  ENDED: [],
} as const;

export default async function PublishedAdPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { brand } = await requireBrand();
  const { id } = await params;
  const view = (await searchParams).view === "7" ? "7" : "total";
  const { ads, targets, brand: fullBrand } = await loadAdResults(brand.id, { adId: id });
  const r = ads[0];
  if (!r) notFound();
  const { ad, summary, evaluation: e } = r;
  const v = ad.variant;
  const shown = view === "7" ? summary.last7 : summary.total;
  const until = ad.endedAt ? ad.endedAt.toISOString().slice(0, 10) : summary.lastDataDay;
  const options = OPTIONS[ad.lifecycle];

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/results" className="hover:underline">← Resultados</Link>}
        title={ad.name ?? v?.adKey ?? ad.externalAdId}
        subtitle={<span className="break-all">{PLATFORM[ad.platform]} · ID <span className="font-mono">{ad.externalAdId}</span></span>}
        actions={<><Pill>{PHASE_LABEL[ad.lifecycle]}</Pill><VerdictPill verdict={e.verdict} /></>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Estratégia" className="lg:col-span-2">
          {v ? (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Campanha"><Link className="text-accent hover:underline" href={`/campaigns/${v.campaign.id}`}>{v.campaign.name}</Link></Detail>
              <Detail label="Anúncio interno"><Link className="break-all text-accent hover:underline" href={`/variants/${v.id}`}>{v.adKey}</Link></Detail>
              <div className="sm:col-span-2"><Detail label="Hipótese">{v.campaign.hypothesis}</Detail></div>
              <Detail label="Ângulo">{v.angle}</Detail>
              <Detail label="Variável testada">{v.campaign.testVariable}</Detail>
              <div className="sm:col-span-2"><Detail label="Gancho">{v.hook}</Detail></div>
              <Detail label="Persona">{v.campaign.persona}</Detail>
            </div>
          ) : (
            <p className="text-sm text-warn">Sem anúncio interno vinculado. <Link href="/published" className="underline">Vincular</Link> para ver a estratégia.</p>
          )}
        </Panel>
        <Panel title="Período">
          <div className="grid gap-3 text-sm">
            <Detail label="Primeiro dia com gasto">{summary.firstSpendDay ?? "Ainda não começou"}</Detail>
            <Detail label={ad.endedAt ? "Encerrado em" : "Último dia com métrica"}>{until ?? "—"}</Detail>
            <Detail label="Dias rodando">{summary.firstSpendDay && until ? String(daysBetween(summary.firstSpendDay, until) + 1) : "—"}</Detail>
            <Detail label="Hoje">{dayLabel(e)}</Detail>
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Resultado"
        aside={
          <span className="flex gap-2">
            <LinkButton href={`/published/${ad.id}`} variant={view === "total" ? "primary" : "default"}>Total</LinkButton>
            <LinkButton href={`/published/${ad.id}?view=7`} variant={view === "7" ? "primary" : "default"}>Últimos 7 dias</LinkButton>
          </span>
        }
      >
        <KeyNumbers t={shown} currency={targets.currency} />
        <MetaNumbers t={shown} currency={targets.currency} />
        <MoneyNumbers t={shown} currency={targets.currency} />
        <p className="mt-3 text-[11px] text-soft">Fonte: métricas cadastradas no app (Manual/CSV). Meta API não conectada.</p>
      </Panel>

      <Panel className="mt-4" title="Análise de hoje" aside={dayLabel(e)}>
        <EvaluationBox e={e} />
        {ad.lifecycle === "ENDED" && (
          <p className="mt-4 rounded-[9px] border border-line px-3 py-2 text-sm">
            Anúncio encerrado em {ad.endedAt?.toISOString().slice(0, 10)}. Confira se ele está pausado no Gerenciador de Anúncios.
          </p>
        )}
        {options.length > 0 && (
          <ActionForm action={recordDecision.bind(null, ad.id)} className="mt-4 grid gap-3 md:grid-cols-3">
            <Select label="Registrar decisão" name="action" options={[...options]} />
            <div className="md:col-span-2">
              <TextArea label="Aprendizado (opcional)" name="note" rows={2} placeholder="O que funcionou, o que não funcionou, o que testar no próximo." />
            </div>
            <div>
              <Button type="submit" variant="primary">Salvar decisão</Button>
            </div>
          </ActionForm>
        )}
        <p className="mt-3 text-[11px] text-soft">O app só sugere. Pause ou ligue o anúncio no Gerenciador de Anúncios e registre aqui.</p>
      </Panel>

      <Panel className="mt-4" title="Linha do tempo">
        {ad.decisions.length === 0 ? (
          <p className="text-sm text-soft">Nenhuma decisão registrada ainda.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {ad.decisions.map((d) => (
              <li key={d.id} className="rounded-[9px] border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{ACTION_LABEL[d.action]}</strong>
                  <span className="text-xs text-soft">{dayInZone(d.decidedAt, fullBrand.timezone)} · app sugeria: {VERDICT_LABEL[d.suggested as Verdict] ?? d.suggested}</span>
                </div>
                {d.reasons.length > 0 && <div className="mt-1 text-xs text-soft">{d.reasons.join(" ")}</div>}
                {d.note && <div className="mt-2 whitespace-pre-wrap">{d.note}</div>}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
