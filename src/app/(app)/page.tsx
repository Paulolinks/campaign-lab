import Link from "next/link";
import { aggregate, periodStart } from "@/domain/dashboard";
import { formatMoney, formatPercent, formatRatio } from "@/domain/metrics";
import { db } from "@/lib/db";
import { humanize } from "@/lib/labels";
import { requireBrand } from "@/lib/session";
import { Empty, LinkButton, Metric, PageHeader, Panel, Pill } from "../ui";

const PERIODS = [7, 14, 30, 90];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { brand } = await requireBrand();
  const requested = Number((await searchParams).days);
  const days = PERIODS.includes(requested) ? requested : 30;
  const since = periodStart(days);
  const cur = brand.currency;

  const [leads, insights, campaigns, unlinkedAds, variantsWithoutMedia, lastInsight] = await Promise.all([
    db().lead.findMany({
      where: { brandId: brand.id, createdAt: { gte: since } },
      select: {
        status: true,
        sourcePlatform: true,
        variant: { select: { angle: true } },
        statusChanges: { select: { to: true } },
        estimates: { select: { status: true } },
        jobs: { select: { contractAmount: true, directCosts: true } },
      },
    }),
    db().dailyAdInsight.findMany({
      where: { date: { gte: since }, publishedAd: { brandId: brand.id } },
      select: { spend: true, impressions: true, linkClicks: true, source: true, publishedAd: { select: { variant: { select: { angle: true } } } } },
    }),
    db().campaignPlan.count({ where: { brandId: brand.id } }),
    db().publishedAd.count({ where: { brandId: brand.id, variantId: null } }),
    db().adVariant.count({ where: { brandId: brand.id, assets: { none: {} } } }),
    db().dailyAdInsight.findFirst({ where: { publishedAd: { brandId: brand.id } }, orderBy: { ingestedAt: "desc" }, select: { ingestedAt: true, source: true } }),
  ]);

  const r = aggregate(
    leads.map((l) => ({
      status: l.status,
      history: l.statusChanges.map((c) => c.to),
      variantAngle: l.variant?.angle ?? null,
      hasSource: !!l.sourcePlatform,
      estimates: l.estimates,
      jobs: l.jobs,
    })),
    insights.map((i) => ({ spend: i.spend, impressions: i.impressions, linkClicks: i.linkClicks, variantAngle: i.publishedAd.variant?.angle ?? null })),
  );
  const c = r.card;
  const hasMedia = insights.length > 0;
  const sources = [...new Set(insights.map((i) => (i.source === "MANUAL" ? "Manual" : i.source)))].join(", ");
  const funnel = [
    ["Impressões", hasMedia ? r.media.impressions : null],
    ["Cliques no link", hasMedia ? r.media.linkClicks : null],
    ["Leads", r.funnel.leads],
    ["Qualificados", r.funnel.qualified],
    ["Visitas", r.funnel.appointments],
    ["Orçamentos", r.funnel.estimatesSent],
    ["Contratos", r.funnel.won],
  ] as const;
  const maxCpql = Math.max(...r.byAngle.map((a) => a.cpql ?? 0), 1);

  return (
    <>
      <PageHeader
        eyebrow="Painel de resultados"
        title="Visão geral"
        subtitle={`${brand.name} · últimos ${days} dias`}
        actions={PERIODS.map((p) => (
          <LinkButton key={p} href={`/?days=${p}`} variant={p === days ? "primary" : "default"}>
            {p} dias
          </LinkButton>
        ))}
      />

      {campaigns === 0 && (
        <div className="mb-4">
          <Empty action={<LinkButton href="/import" variant="primary">Importar campanha</LinkButton>}>Esta marca ainda não tem campanhas.</Empty>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Metric label="Gasto em anúncios" value={formatMoney(hasMedia ? c.spend : null, cur)} hint={hasMedia ? `Fonte: ${sources}` : "Sem métricas cadastradas"} />
        <Metric label="Leads" value={String(c.leads)} hint="CRM · entraram no período" />
        <Metric label="Qualificados" value={String(c.qualified)} hint={`${formatPercent(c.qualificationRate)} dos leads`} />
        <Metric label="Orçamentos enviados" value={String(c.estimatesSent)} hint="Não confundir com leads" />
        <Metric label="Contratos" value={String(c.won)} hint={`Receita ${formatMoney(c.won ? c.revenue : null, cur)}`} />
        <Metric label="Após custos + mídia" value={formatMoney(c.contributionAfterMedia, cur)} hint="Não é lucro líquido" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <Metric label="CPL real" value={formatMoney(c.cpl, cur)} />
        <Metric label="CPQL" value={formatMoney(c.cpql, cur)} />
        <Metric label="CAC de mídia" value={formatMoney(c.cac, cur)} />
        <Metric label="Taxa de fechamento" value={formatPercent(c.closeRate)} hint="contratos / orçamentos" />
        <Metric label="Margem bruta" value={formatPercent(c.grossMargin)} />
        <Metric label="ROAS" value={formatRatio(c.roas)} hint="Receita não é lucro" />
        <Metric label="CPM" value={formatMoney(c.cpm, cur)} />
        <Metric label="CTR (link)" value={formatPercent(c.linkCtr)} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Panel title="Funil comercial" aside="Mídia por data do gasto · leads por data de entrada">
          <div className="flex min-h-44 items-end gap-2 sm:gap-3">
            {funnel.map(([label, n], i) => (
              <div key={label} className="min-w-0 flex-1 text-center">
                <div
                  className="grid min-h-2 place-items-start justify-center rounded-t-[7px] rounded-b-[3px] bg-gradient-to-b from-[#56cbb5] to-[#297883] pt-2 text-xs font-extrabold text-white"
                  style={{ height: `${150 - i * 19}px` }}
                >
                  {n === null ? "N/D" : n.toLocaleString("en-US")}
                </div>
                <div className="mt-1.5 min-h-8 text-[9px] leading-tight text-soft [overflow-wrap:anywhere] sm:text-[10px]">{label}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-soft">Alturas ilustram as etapas (fora de escala). Números da plataforma e do CRM têm naturezas diferentes e não são somados.</p>
        </Panel>

        <Panel title="Qualidade por ângulo" aside="CPQL: custo por lead qualificado">
          {r.byAngle.length === 0 ? (
            <Empty>Sem dados por ângulo ainda. Vincule anúncios publicados às variantes e registre leads com o anúncio de origem.</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {r.byAngle.map((a) => (
                <div key={a.angle} className="grid grid-cols-[110px_1fr_64px] items-center gap-2 text-[11px]">
                  <span className="truncate" title={a.angle}>
                    {humanize(a.angle)}
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-[#26354a]">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${a.cpql === null ? 0 : Math.max(6, (a.cpql / maxCpql) * 100)}%` }} />
                  </span>
                  <b className="text-right">{formatMoney(a.cpql, cur)}</b>
                  <span className="col-span-3 -mt-2 text-[10px] text-soft">
                    gasto {formatMoney(a.spend, cur)} · {a.leads} leads · {a.qualified} qualif. · {a.won} contratos
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-[11px] text-success">✓ Priorize o cliente qualificado, não o anúncio com mais likes.</p>
        </Panel>
      </div>

      <Panel title="Qualidade dos dados">
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex flex-wrap items-center gap-2">
            <Pill tone="neutral">Meta API: não conectada</Pill>
            <Pill tone="neutral">GA4: não conectado</Pill>
            <Pill tone="neutral">Google Drive: não conectado</Pill>
            <span className="text-soft">
              {lastInsight ? `Última métrica cadastrada: ${lastInsight.ingestedAt.toISOString().slice(0, 10)} (${lastInsight.source === "MANUAL" ? "Manual" : lastInsight.source})` : "Nenhuma métrica de mídia cadastrada."}
            </span>
          </li>
          {r.leadsWithoutSource > 0 && <li className="text-warn">{r.leadsWithoutSource} lead(s) sem origem no período.</li>}
          {unlinkedAds > 0 && (
            <li className="text-warn">
              <Link href="/published" className="hover:underline">
                {unlinkedAds} anúncio(s) publicado(s) sem vínculo com variante.
              </Link>
            </li>
          )}
          {variantsWithoutMedia > 0 && <li className="text-soft">{variantsWithoutMedia} variante(s) sem vídeo/imagem.</li>}
        </ul>
      </Panel>
    </>
  );
}
