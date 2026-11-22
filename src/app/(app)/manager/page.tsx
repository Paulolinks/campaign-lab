import Link from "next/link";
import { adDelivery, groupDelivery, type Delivery } from "@/domain/ad-delivery";
import { costPer, formatMoney, toCents } from "@/domain/metrics";
import { db } from "@/lib/db";
import { humanize } from "@/lib/labels";
import { requireBrand } from "@/lib/session";
import { LinkButton, PageHeader } from "../../ui";
import { AdPreview, PLACEMENTS, type Placement } from "../ad-preview";
import { ApprovalBox } from "../approvals/approval-box";
import { MetaView } from "./meta-view";

type Tab = "campaigns" | "adsets" | "ads";
type Search = { tab?: string; c?: string; ad?: string; p?: string; view?: string; s?: string; period?: string };

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "campaigns", label: "Campanhas", icon: "▣" },
  { key: "adsets", label: "Conjuntos de anúncios", icon: "▦" },
  { key: "ads", label: "Anúncios", icon: "▭" },
];

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      title="Ligar e desligar ainda é feito no Gerenciador da Meta"
      className={`relative inline-block h-5 w-9 rounded-full ${on ? "bg-[#1877f2]" : "bg-[#3a4658]"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${on ? "left-[18px]" : "left-0.5"}`} />
    </span>
  );
}

function DeliveryCell({ d }: { d: Delivery }) {
  const dot = { ok: "bg-[#42b72a]", warn: "bg-[#f7b928]", danger: "bg-[#e4544b]", neutral: "bg-[#8a94a6]" }[d.tone];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {d.label}
    </span>
  );
}

function ViewSwitch({ view }: { view: "meta" | "plan" }) {
  const item = (key: "meta" | "plan", label: string) => (
    <Link
      href={`/manager?view=${key}`}
      className={`rounded-lg px-4 py-2 text-sm font-semibold ${view === key ? "bg-[#1877f2] text-white" : "text-soft hover:text-white"}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mb-4 inline-flex rounded-xl border border-line bg-surface p-1">
      {item("meta", "Na Meta")}
      {item("plan", "Planejado no app")}
    </div>
  );
}

const ex = (extra: unknown, key: string) => ((extra ?? {}) as Record<string, string>)[key] ?? null;

export default async function ManagerPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : sp.ad ? "ads" : "campaigns";
  const placement: Placement = sp.p === "ig" || sp.p === "story" ? sp.p : "fb";
  const { brand } = await requireBrand();
  const connected = !!(await db().metaConnection.findUnique({ where: { brandId: brand.id }, select: { id: true } }));
  const view = sp.view === "plan" || (!connected && sp.view !== "meta") ? "plan" : "meta";
  if (view === "meta") {
    return (
      <>
        <PageHeader
          eyebrow={brand.name}
          title="Gerenciador de anúncios"
          subtitle="O que está rodando na Meta, com os números da própria Meta. Só leitura: ligar, pausar e orçamento continuam no Gerenciador da Meta."
        />
        <ViewSwitch view="meta" />
        {connected ? (
          <MetaView brandId={brand.id} currency={brand.currency} timeZone={brand.timezone} sp={sp} />
        ) : (
          <div className="rounded-[13px] border border-line bg-surface p-10 text-center text-soft">
            A Meta ainda não está conectada.{" "}
            <Link href="/integrations#meta" className="font-semibold text-accent">Conecte em Integrações</Link>.
          </div>
        )}
      </>
    );
  }
  const full = await db().brand.findUniqueOrThrow({ where: { id: brand.id }, select: { domain: true, adDailyBudget: true } });

  const campaigns = await db().campaignPlan.findMany({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
    include: {
      variants: {
        orderBy: { adKey: "asc" },
        include: {
          assets: { orderBy: { createdAt: "asc" }, take: 1 },
          publishedAds: { select: { lifecycle: true, insights: { select: { spend: true } } } },
          leads: { where: { status: { not: "DISQUALIFIED" } }, select: { id: true } },
        },
      },
    },
  });

  const rows = campaigns.flatMap((c) =>
    c.variants.map((v) => {
      const spend = v.publishedAds.flatMap((p) => p.insights).reduce((s, i) => s + toCents(i.spend), 0);
      const budget = ex(v.extra, "ADSET_BUDGET_USD_PER_DAY") ?? full.adDailyBudget?.toString() ?? null;
      return {
        v,
        campaign: c,
        delivery: adDelivery(v.approvalStatus, v.publishedAds.map((p) => p.lifecycle)),
        spend,
        hasSpend: v.publishedAds.some((p) => p.insights.length > 0),
        leads: v.leads.length,
        adSet: {
          name: ex(v.extra, "ADSET_NAME") ?? `Conjunto ${v.adKey}`,
          budget: budget ? Number(budget) : null,
          location: ex(v.extra, "ADSET_LOCATION") ?? c.market ?? "—",
          age: ex(v.extra, "ADSET_AGE") ?? "—",
          placements: ex(v.extra, "ADSET_PLACEMENTS") ?? "Advantage+",
          optimization: ex(v.extra, "ADSET_OPTIMIZATION") ?? humanize(c.ctaDestination),
        },
      };
    }),
  );
  const filtered = sp.c ? rows.filter((r) => r.campaign.id === sp.c) : rows;
  const selectedCampaign = sp.c ? campaigns.find((c) => c.id === sp.c) : null;
  const selected = sp.ad ? rows.find((r) => r.v.id === sp.ad) : null;
  const pending = rows.filter((r) => r.v.approvalStatus === "PENDING").length;
  const cur = brand.currency;
  const money = (cents: number | null, has = true) => (has ? formatMoney(cents, cur) : "—");

  const href = (q: Partial<Search>) => {
    const params = new URLSearchParams();
    const merged = { view: "plan", tab, c: sp.c, ...q };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/manager?${params}`;
  };

  return (
    <>
      <PageHeader
        eyebrow={brand.name}
        title="Gerenciador de anúncios"
        subtitle="Igual ao da Meta: campanha → conjunto → anúncio. Clique num anúncio para ver como fica no celular e aprovar."
        actions={
          <>
            {pending > 0 && <span className="self-center rounded-full bg-[#3d3022] px-3 py-1.5 text-sm font-bold text-warn">{pending} esperando sua aprovação</span>}
            <LinkButton href="/import" variant="primary">
              + Importar campanha
            </LinkButton>
          </>
        }
      />

      <ViewSwitch view="plan" />
      <div className={`grid gap-4 ${selected ? "2xl:grid-cols-[1fr_520px]" : ""}`}>
        <div className="min-w-0 overflow-hidden rounded-[13px] border border-line bg-surface">
          <div className="flex flex-wrap border-b border-line">
            {TABS.map((t) => {
              const count = t.key === "campaigns" ? campaigns.length : filtered.length;
              const active = t.key === tab;
              return (
                <Link
                  key={t.key}
                  href={href({ tab: t.key, ad: undefined })}
                  className={`flex items-center gap-2 border-b-[3px] px-5 py-3.5 text-sm font-semibold ${active ? "border-[#1877f2] bg-[#14243a] text-white" : "border-transparent text-soft hover:text-white"}`}
                >
                  <span>{t.icon}</span>
                  {t.label}
                  {t.key !== "campaigns" && selectedCampaign ? <span className="text-xs font-normal">de 1 campanha</span> : <span className="text-xs font-normal">({count})</span>}
                </Link>
              );
            })}
            {selectedCampaign && (
              <Link href={href({ c: undefined, ad: undefined })} className="ml-auto self-center px-4 text-xs text-accent hover:underline">
                ✕ Limpar filtro: {selectedCampaign.name}
              </Link>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead className="bg-[#101b2a] text-[11px] uppercase tracking-wide text-soft">
                {tab === "campaigns" && (
                  <tr>
                    <th className="w-14 px-4 py-3">Lig./Desl.</th>
                    <th className="px-3 py-3">Campanha</th>
                    <th className="px-3 py-3">Veiculação</th>
                    <th className="px-3 py-3">Objetivo</th>
                    <th className="px-3 py-3 text-right">Orçamento</th>
                    <th className="px-3 py-3 text-right">Resultados</th>
                    <th className="px-3 py-3 text-right">Custo por resultado</th>
                    <th className="px-3 py-3 text-right">Valor usado</th>
                  </tr>
                )}
                {tab === "adsets" && (
                  <tr>
                    <th className="w-14 px-4 py-3">Lig./Desl.</th>
                    <th className="px-3 py-3">Conjunto de anúncios</th>
                    <th className="px-3 py-3">Veiculação</th>
                    <th className="px-3 py-3 text-right">Orçamento</th>
                    <th className="px-3 py-3">Público</th>
                    <th className="px-3 py-3">Posicionamentos</th>
                    <th className="px-3 py-3 text-right">Resultados</th>
                    <th className="px-3 py-3 text-right">Valor usado</th>
                  </tr>
                )}
                {tab === "ads" && (
                  <tr>
                    <th className="w-14 px-4 py-3">Lig./Desl.</th>
                    <th className="px-3 py-3">Anúncio</th>
                    <th className="px-3 py-3">Veiculação</th>
                    <th className="px-3 py-3">Conjunto</th>
                    <th className="px-3 py-3">Mídia</th>
                    <th className="px-3 py-3 text-right">Resultados</th>
                    <th className="px-3 py-3 text-right">Custo por resultado</th>
                    <th className="px-3 py-3 text-right">Valor usado</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-line">
                {tab === "campaigns" &&
                  campaigns.map((c) => {
                    const rs = rows.filter((r) => r.campaign.id === c.id);
                    const d = groupDelivery(rs.map((r) => r.delivery));
                    const spend = rs.reduce((s, r) => s + r.spend, 0);
                    const leads = rs.reduce((s, r) => s + r.leads, 0);
                    const has = rs.some((r) => r.hasSpend);
                    return (
                      <tr key={c.id} className="hover:bg-[#14243a]">
                        <td className="px-4 py-3">
                          <Toggle on={d.on} />
                        </td>
                        <td className="px-3 py-3">
                          <Link href={href({ tab: "adsets", c: c.id, ad: undefined })} className="font-semibold text-[#4599ff] hover:underline">
                            {c.name}
                          </Link>
                          <div className="text-[11px] text-soft">
                            {rs.length} anúncios ·{" "}
                            <Link href={`/campaigns/${c.id}`} className="hover:underline">
                              funil e detalhes
                            </Link>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <DeliveryCell d={d} />
                        </td>
                        <td className="px-3 py-3">{humanize(c.objective)}</td>
                        <td className="px-3 py-3 text-right">{c.budgetPerDay ? `${formatMoney(toCents(c.budgetPerDay), cur)}/dia` : "Nos conjuntos"}</td>
                        <td className="px-3 py-3 text-right">{leads ? `${leads} leads` : "—"}</td>
                        <td className="px-3 py-3 text-right">{has ? money(costPer(spend, leads)) : "—"}</td>
                        <td className="px-3 py-3 text-right">{money(spend, has)}</td>
                      </tr>
                    );
                  })}
                {tab === "adsets" &&
                  filtered.map((r) => (
                    <tr key={r.v.id} className="hover:bg-[#14243a]">
                      <td className="px-4 py-3">
                        <Toggle on={r.delivery.on} />
                      </td>
                      <td className="px-3 py-3">
                        <Link href={href({ tab: "ads", ad: r.v.id })} className="font-semibold text-[#4599ff] hover:underline">
                          {r.adSet.name}
                        </Link>
                        <div className="text-[11px] text-soft">{r.adSet.optimization}</div>
                      </td>
                      <td className="px-3 py-3">
                        <DeliveryCell d={r.delivery} />
                      </td>
                      <td className="px-3 py-3 text-right">{r.adSet.budget ? `${formatMoney(Math.round(r.adSet.budget * 100), cur)}/dia` : "—"}</td>
                      <td className="max-w-56 px-3 py-3 text-[12px]">
                        {r.adSet.location}
                        <div className="text-soft">Idade {r.adSet.age}</div>
                      </td>
                      <td className="max-w-48 px-3 py-3 text-[12px]">{r.adSet.placements}</td>
                      <td className="px-3 py-3 text-right">{r.leads ? `${r.leads} leads` : "—"}</td>
                      <td className="px-3 py-3 text-right">{money(r.spend, r.hasSpend)}</td>
                    </tr>
                  ))}
                {tab === "ads" &&
                  filtered.map((r) => (
                    <tr key={r.v.id} className={r.v.id === sp.ad ? "bg-[#1a3354]" : "hover:bg-[#14243a]"}>
                      <td className="px-4 py-3">
                        <Toggle on={r.delivery.on} />
                      </td>
                      <td className="px-3 py-3">
                        <Link href={href({ tab: "ads", ad: r.v.id })} className="font-semibold text-[#4599ff] hover:underline">
                          {r.v.name ?? r.v.headline}
                        </Link>
                        <div className="text-[11px] text-soft">{r.v.headline}</div>
                      </td>
                      <td className="px-3 py-3">
                        <DeliveryCell d={r.delivery} />
                      </td>
                      <td className="max-w-48 px-3 py-3 text-[12px]">{r.adSet.name}</td>
                      <td className="px-3 py-3 text-[12px]">{r.v.assets.length ? "✓ Enviada" : <span className="text-warn">Falta vídeo</span>}</td>
                      <td className="px-3 py-3 text-right">{r.leads ? `${r.leads} leads` : "—"}</td>
                      <td className="px-3 py-3 text-right">{r.hasSpend ? money(costPer(r.spend, r.leads)) : "—"}</td>
                      <td className="px-3 py-3 text-right">{money(r.spend, r.hasSpend)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {campaigns.length === 0 && (
              <div className="p-10 text-center text-soft">
                Nenhuma campanha ainda.{" "}
                <Link href="/import" className="font-semibold text-accent">
                  Importe o arquivo .txt da campanha
                </Link>{" "}
                e ela aparece aqui.
              </div>
            )}
          </div>
          {tab !== "ads" && rows.length > 0 && <p className="border-t border-line px-4 py-3 text-xs text-soft">Dica: abra a aba Anúncios e clique num anúncio para ver a prévia e aprovar.</p>}
        </div>

        {selected && (
          <aside className="rounded-[13px] border border-line bg-surface">
            <div className="flex items-start justify-between gap-3 border-b border-line p-4">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-soft">Prévia do anúncio</div>
                <div className="font-bold">{selected.v.name ?? selected.v.headline}</div>
                <div className="text-xs text-soft">
                  {selected.campaign.name} → {selected.adSet.name}
                </div>
              </div>
              <Link href={href({ ad: undefined })} className="rounded-md border border-line px-2 py-1 text-sm text-soft hover:text-white" aria-label="Fechar prévia">
                ✕
              </Link>
            </div>
            <div className="flex gap-1 border-b border-line px-4 pt-3">
              {PLACEMENTS.map((p) => (
                <Link
                  key={p.key}
                  href={href({ tab: "ads", ad: selected.v.id, p: p.key })}
                  className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${p.key === placement ? "bg-[#e9ebee] text-[#050505]" : "text-soft hover:text-white"}`}
                >
                  {p.label}
                </Link>
              ))}
            </div>
            <div className="flex justify-center bg-[#e9ebee] p-5">
              <AdPreview
                placement={placement}
                ad={{
                  brandName: brand.name,
                  domain: full.domain,
                  primaryText: selected.v.primaryText,
                  headline: selected.v.headline,
                  description: selected.v.description,
                  cta: selected.v.cta,
                  hook: selected.v.hook,
                  media: selected.v.assets[0] ?? null,
                }}
              />
            </div>
            <div className="border-t border-line p-4">
              <h3 className="mb-3 text-sm font-bold">Sua decisão</h3>
              <ApprovalBox
                variantId={selected.v.id}
                approvalStatus={selected.v.approvalStatus}
                approvalNote={selected.v.approvalNote}
                approvalAt={selected.v.approvalAt}
                timeZone={brand.timezone}
              />
            </div>
            <div className="grid gap-2 border-t border-line p-4 text-[13px]">
              <div>
                <span className="text-soft">Orçamento:</span> {selected.adSet.budget ? `${formatMoney(Math.round(selected.adSet.budget * 100), cur)} por dia` : "—"}
              </div>
              <div>
                <span className="text-soft">Público:</span> {selected.adSet.location} · idade {selected.adSet.age}
              </div>
              <div>
                <span className="text-soft">Onde aparece:</span> {selected.adSet.placements}
              </div>
              {ex(selected.v.extra, "FORM_QUESTIONS") && (
                <div>
                  <span className="text-soft">Perguntas do formulário:</span> {ex(selected.v.extra, "FORM_QUESTIONS")}
                </div>
              )}
              <Link href={`/variants/${selected.v.id}`} className="mt-1 font-semibold text-accent hover:underline">
                Abrir o anúncio completo (vídeo, roteiro, histórico) →
              </Link>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
