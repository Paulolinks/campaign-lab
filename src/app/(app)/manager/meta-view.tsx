import Link from "next/link";
import { PERIOD_PRESETS, deliveryOf, periodMetrics, suggestVariant, type PeriodPreset } from "@/domain/meta-sync";
import { formatMoney, formatPercent, toCents } from "@/domain/metrics";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { ActionForm } from "../../action-form";
import { Button } from "../../ui";
import { linkPublishedAd } from "../published/actions";

export type MetaTab = "campaigns" | "adsets" | "ads";
export type MetaSearch = { tab?: string; c?: string; s?: string; period?: string };

const TABS: { key: MetaTab; label: string; icon: string }[] = [
  { key: "campaigns", label: "Campanhas", icon: "▣" },
  { key: "adsets", label: "Conjuntos de anúncios", icon: "▦" },
  { key: "ads", label: "Anúncios", icon: "▭" },
];

const LEVEL: Record<MetaTab, string> = { campaigns: "campaign", adsets: "adset", ads: "ad" };

type Numbers = { spendCents: number; impressions: number; reach: number | null; frequency: number | null; clicks: number | null; linkClicks: number | null; leads: number | null };
const EMPTY: Numbers = { spendCents: 0, impressions: 0, reach: null, frequency: null, clicks: null, linkClicks: null, leads: null };

const count = (n: number | null) => (n === null ? "—" : n.toLocaleString("pt-BR"));

function Toggle({ on }: { on: boolean }) {
  return (
    <span title="Ligar e desligar ainda é feito no Gerenciador da Meta" className={`relative inline-block h-5 w-9 rounded-full ${on ? "bg-[#1877f2]" : "bg-[#3a4658]"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${on ? "left-[18px]" : "left-0.5"}`} />
    </span>
  );
}

function Delivery({ status }: { status: string | null }) {
  const d = deliveryOf(status);
  const dot = { ok: "bg-[#42b72a]", warn: "bg-[#f7b928]", danger: "bg-[#e4544b]", neutral: "bg-[#8a94a6]" }[d.tone];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {d.label}
    </span>
  );
}

const NUMBER_HEADS = ["Resultados", "Custo por resultado", "Valor usado", "Alcance", "Impressões", "Frequência", "CPM", "Cliques no link", "CPC", "CTR"];

function NumberCells({ n, currency }: { n: Numbers; currency: string }) {
  const m = periodMetrics(n);
  const money = (c: number | null) => (c === null ? "—" : formatMoney(c, currency));
  const cells = [
    n.leads ? `${count(n.leads)} leads` : "—",
    money(m.costPerResultCents),
    formatMoney(n.spendCents, currency),
    count(n.reach),
    count(n.impressions),
    n.frequency === null ? "—" : n.frequency.toFixed(2),
    money(m.cpmCents),
    count(n.linkClicks),
    money(m.cpcCents),
    m.ctr === null ? "—" : formatPercent(m.ctr),
  ];
  return (
    <>
      {cells.map((v, i) => (
        <td key={NUMBER_HEADS[i]} className="whitespace-nowrap px-3 py-3 text-right">
          {v}
        </td>
      ))}
    </>
  );
}

function budget(daily: unknown, lifetime: unknown, currency: string) {
  if (daily) return `${formatMoney(toCents(daily as string), currency)}/dia`;
  if (lifetime) return `${formatMoney(toCents(lifetime as string), currency)} total`;
  return null;
}

/** Gerenciador → "Na Meta": what really runs on Meta, with Meta's own numbers for the chosen period (spec 04, US-3). */
export async function MetaView({ brandId, currency, timeZone, sp }: { brandId: string; currency: string; timeZone: string; sp: MetaSearch }) {
  const tab: MetaTab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as MetaTab) : "campaigns";
  const period: PeriodPreset = PERIOD_PRESETS.some((p) => p.key === sp.period) ? (sp.period as PeriodPreset) : "last_7d";

  const [campaigns, adSets, ads, numbers, variants, lastOk, lastRun] = await Promise.all([
    db().metaCampaign.findMany({ where: { brandId }, orderBy: { externalCreatedAt: "desc" } }),
    db().metaAdSet.findMany({ where: { brandId, ...(sp.c ? { campaignExternalId: sp.c } : {}) }, orderBy: { externalCreatedAt: "desc" } }),
    db().publishedAd.findMany({
      where: { brandId, platform: "META", lastSyncAt: { not: null }, ...(sp.c ? { externalCampaignId: sp.c } : {}), ...(sp.s ? { externalAdSetId: sp.s } : {}) },
      orderBy: { externalCreatedAt: "desc" },
      include: { variant: { select: { id: true, adKey: true, name: true } } },
    }),
    db().metaPeriodInsight.findMany({ where: { brandId, preset: period, level: LEVEL[tab] } }),
    db().adVariant.findMany({ where: { brandId }, select: { id: true, adKey: true, name: true } }),
    db().metaSyncRun.findFirst({ where: { brandId, kind: { in: ["FULL", "INCREMENTAL"] }, status: "SUCCESS" }, orderBy: { startedAt: "desc" } }),
    db().metaSyncRun.findFirst({ where: { brandId, kind: { in: ["FULL", "INCREMENTAL"] } }, orderBy: { startedAt: "desc" } }),
  ]);

  const byId = new Map<string, Numbers>(
    numbers.map((n) => [n.externalId, { spendCents: toCents(n.spend), impressions: n.impressions, reach: n.reach, frequency: n.frequency, clicks: n.clicks, linkClicks: n.linkClicks, leads: n.leads }]),
  );
  const num = (id: string) => byId.get(id) ?? EMPTY;
  const active = (s: string | null) => (deliveryOf(s).on ? 0 : 1);
  // Like Meta: what is running first, then what spent the most in the period.
  const sortRows = <T,>(rows: T[], id: (r: T) => string, status: (r: T) => string | null) =>
    [...rows].sort((a, b) => active(status(a)) - active(status(b)) || num(id(b)).spendCents - num(id(a)).spendCents);

  const campaignName = new Map(campaigns.map((c) => [c.externalId, c.name]));
  const adSetName = new Map(adSets.map((a) => [a.externalId, a.name]));
  const selectedCampaign = sp.c ? campaigns.find((c) => c.externalId === sp.c) : null;
  const selectedAdSet = sp.s ? adSets.find((a) => a.externalId === sp.s) : null;

  const visibleIds =
    tab === "campaigns" ? campaigns.map((c) => c.externalId) : tab === "adsets" ? adSets.map((a) => a.externalId) : ads.map((a) => a.externalAdId);
  const total = visibleIds.reduce<Numbers>((t, id) => {
    const n = num(id);
    return { ...t, spendCents: t.spendCents + n.spendCents, impressions: t.impressions + n.impressions, linkClicks: (t.linkClicks ?? 0) + (n.linkClicks ?? 0), clicks: (t.clicks ?? 0) + (n.clicks ?? 0), leads: (t.leads ?? 0) + (n.leads ?? 0) };
  }, { ...EMPTY });

  const href = (q: Partial<MetaSearch>) => {
    const params = new URLSearchParams({ view: "meta" });
    const merged = { tab, c: sp.c, s: sp.s, period, ...q };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/manager?${params}`;
  };

  if (!lastRun) {
    return (
      <div className="rounded-[13px] border border-line bg-surface p-10 text-center text-soft">
        Ainda não sincronizou com a Meta.{" "}
        <Link href="/integrations#meta" className="font-semibold text-accent">
          Abra Integrações e clique em Sincronizar agora
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {lastRun.status === "ERROR" && (
        <div className="rounded-xl border border-[#6b2f2f] bg-[#3a1d1d] p-3 text-sm text-danger">
          A última sincronização parou em {lastRun.step}: {lastRun.error}{" "}
          <Link href="/integrations#meta" className="font-semibold underline">Ver em Integrações</Link>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {PERIOD_PRESETS.map((p) => (
          <Link
            key={p.key}
            href={href({ period: p.key })}
            className={`rounded-full border px-3 py-1 text-xs ${p.key === period ? "border-[#1877f2] bg-[#14243a] text-white" : "border-line text-soft hover:text-white"}`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="min-w-0 overflow-hidden rounded-[13px] border border-line bg-surface">
        <div className="flex flex-wrap border-b border-line">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={href({ tab: t.key })}
              className={`flex items-center gap-2 border-b-[3px] px-5 py-3.5 text-sm font-semibold ${t.key === tab ? "border-[#1877f2] bg-[#14243a] text-white" : "border-transparent text-soft hover:text-white"}`}
            >
              <span>{t.icon}</span>
              {t.label}
            </Link>
          ))}
          {(selectedCampaign || selectedAdSet) && (
            <Link href={href({ c: undefined, s: undefined })} className="ml-auto self-center px-4 text-xs text-accent hover:underline">
              ✕ Limpar filtro: {selectedAdSet?.name ?? selectedCampaign?.name}
            </Link>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] text-left text-[13px]">
            <thead className="bg-[#101b2a] text-[11px] uppercase tracking-wide text-soft">
              <tr>
                <th className="w-14 px-4 py-3">Lig./Desl.</th>
                <th className="px-3 py-3">{tab === "campaigns" ? "Campanha" : tab === "adsets" ? "Conjunto de anúncios" : "Anúncio"}</th>
                <th className="px-3 py-3">Veiculação</th>
                {tab !== "ads" && <th className="px-3 py-3 text-right">Orçamento</th>}
                {tab === "ads" && <th className="px-3 py-3">No app</th>}
                {NUMBER_HEADS.map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-3 text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tab === "campaigns" &&
                sortRows(campaigns, (c) => c.externalId, (c) => c.effectiveStatus).map((c) => (
                  <tr key={c.id} className="hover:bg-[#14243a]">
                    <td className="px-4 py-3"><Toggle on={deliveryOf(c.effectiveStatus).on} /></td>
                    <td className="max-w-72 px-3 py-3">
                      <Link href={href({ tab: "adsets", c: c.externalId, s: undefined })} className="font-semibold text-[#4599ff] hover:underline">{c.name}</Link>
                      {c.objective && <div className="text-[11px] text-soft">{c.objective.replace(/^OUTCOME_/, "").toLowerCase()}</div>}
                    </td>
                    <td className="px-3 py-3"><Delivery status={c.effectiveStatus} /></td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">{budget(c.dailyBudget, c.lifetimeBudget, currency) ?? "Nos conjuntos"}</td>
                    <NumberCells n={num(c.externalId)} currency={currency} />
                  </tr>
                ))}
              {tab === "adsets" &&
                sortRows(adSets, (a) => a.externalId, (a) => a.effectiveStatus).map((a) => (
                  <tr key={a.id} className="hover:bg-[#14243a]">
                    <td className="px-4 py-3"><Toggle on={deliveryOf(a.effectiveStatus).on} /></td>
                    <td className="max-w-72 px-3 py-3">
                      <Link href={href({ tab: "ads", c: a.campaignExternalId, s: a.externalId })} className="font-semibold text-[#4599ff] hover:underline">{a.name}</Link>
                      <div className="text-[11px] text-soft">{[campaignName.get(a.campaignExternalId), a.targetingSummary].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-3 py-3"><Delivery status={a.effectiveStatus} /></td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">{budget(a.dailyBudget, a.lifetimeBudget, currency) ?? "Na campanha"}</td>
                    <NumberCells n={num(a.externalId)} currency={currency} />
                  </tr>
                ))}
              {tab === "ads" &&
                sortRows(ads, (a) => a.externalAdId, (a) => a.effectiveStatus).map((a) => {
                  const suggestion = a.variant ? null : suggestVariant(a.name, variants);
                  return (
                    <tr key={a.id} className="hover:bg-[#14243a]">
                      <td className="px-4 py-3"><Toggle on={deliveryOf(a.effectiveStatus).on} /></td>
                      <td className="max-w-72 px-3 py-3">
                        <div className="flex items-center gap-2">
                          {a.thumbnailUrl && (
                            // eslint-disable-next-line @next/next/no-img-element -- Meta CDN thumbnail, tiny and external
                            <img src={a.thumbnailUrl} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                          )}
                          <div className="min-w-0">
                            <Link href={`/published/${a.id}`} className="font-semibold text-[#4599ff] hover:underline">{a.name ?? a.externalAdId}</Link>
                            <div className="truncate text-[11px] text-soft">{adSetName.get(a.externalAdSetId ?? "") ?? campaignName.get(a.externalCampaignId ?? "") ?? ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3"><Delivery status={a.effectiveStatus} /></td>
                      <td className="px-3 py-3 text-[12px]">
                        {a.variant ? (
                          <Link href={`/variants/${a.variant.id}`} className="font-semibold text-accent hover:underline">{a.variant.adKey}</Link>
                        ) : suggestion ? (
                          <ActionForm action={linkPublishedAd.bind(null, a.id)} className="flex items-center gap-1">
                            <input type="hidden" name="variantId" value={suggestion.id} />
                            <Button type="submit" className="px-2 py-1 text-xs">Ligar a {suggestion.adKey}?</Button>
                          </ActionForm>
                        ) : (
                          <Link href={`/published/${a.id}`} className="text-soft hover:text-white hover:underline">Ligar à variante</Link>
                        )}
                      </td>
                      <NumberCells n={num(a.externalAdId)} currency={currency} />
                    </tr>
                  );
                })}
            </tbody>
            {visibleIds.length > 0 && (
              <tfoot className="border-t-2 border-line bg-[#101b2a] font-semibold">
                <tr>
                  <td className="px-4 py-3" />
                  <td className="px-3 py-3" colSpan={tab === "ads" ? 3 : 3}>
                    Total de {visibleIds.length} {tab === "campaigns" ? "campanhas" : tab === "adsets" ? "conjuntos" : "anúncios"}
                    <div className="text-[11px] font-normal text-soft">Alcance e frequência não somam entre linhas (a mesma pessoa pode ver vários).</div>
                  </td>
                  <NumberCells n={{ ...total, reach: null, frequency: null }} currency={currency} />
                </tr>
              </tfoot>
            )}
          </table>
          {visibleIds.length === 0 && <div className="p-10 text-center text-soft">Nada nesta aba{selectedCampaign ? " para o filtro escolhido" : ""}.</div>}
        </div>
        <p className="border-t border-line px-4 py-3 text-xs text-soft">
          Dados da Meta{lastOk ? ` de ${formatDate(lastOk.finishedAt ?? lastOk.startedAt, timeZone)}` : ""} · só leitura · valores na moeda da conta de anúncios.{" "}
          <Link href="/integrations#meta" className="text-accent hover:underline">Sincronizar agora</Link>
        </p>
      </div>
    </div>
  );
}
