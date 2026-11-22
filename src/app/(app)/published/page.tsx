import Link from "next/link";
import { formatMoney, toCents } from "@/domain/metrics";
import { db } from "@/lib/db";
import { PLATFORM } from "@/lib/labels";
import { requireBrand } from "@/lib/session";
import { ActionForm } from "../../action-form";
import { Button, Empty, Field, PageHeader, Panel, Pill, Select } from "../../ui";
import { linkPublishedAd, saveDailyMetric } from "./actions";
import { PublishedAdForm } from "./published-form";

export default async function PublishedPage() {
  const { brand } = await requireBrand();
  const [ads, variants, channels] = await Promise.all([
    db().publishedAd.findMany({
      where: { brandId: brand.id },
      orderBy: { createdAt: "desc" },
      include: { variant: { select: { id: true, adKey: true } }, channelAccount: true, insights: { orderBy: { date: "desc" } } },
    }),
    db().adVariant.findMany({ where: { brandId: brand.id }, select: { id: true, adKey: true }, orderBy: { adKey: "asc" } }),
    db().channelAccount.findMany({ where: { brandId: brand.id }, select: { id: true, name: true, platform: true } }),
  ]);
  const unlinked = ads.filter((a) => !a.variantId).length;
  const variantOptions = [{ value: "", label: "— Sem vínculo —" }, ...variants.map((v) => ({ value: v.id, label: v.adKey }))];

  return (
    <>
      <PageHeader
        eyebrow={brand.name}
        title="Anúncios publicados"
        subtitle="Cada anúncio real (com ID da plataforma) ligado ao anúncio interno. Uma variante pode ter vários anúncios publicados."
        actions={unlinked > 0 ? <Pill tone="warn">{unlinked} sem vínculo</Pill> : undefined}
      />
      <div className="mb-3 rounded-[9px] border border-[#635037] bg-[#34301f] px-4 py-3 text-xs text-[#ffdc9f]">
        Meta Marketing API: <strong>não conectada</strong>. Status e métricas abaixo são cadastrados à mão (fonte: Manual).
      </div>

      {ads.length === 0 ? (
        <Empty>Nenhum anúncio publicado cadastrado.</Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {ads.map((a) => {
            const spend = a.insights.reduce((s, i) => s + toCents(i.spend), 0);
            const impressions = a.insights.reduce((s, i) => s + i.impressions, 0);
            const clicks = a.insights.reduce((s, i) => s + (i.linkClicks ?? 0), 0);
            return (
              <Panel
                key={a.id}
                title={
                  <span className="break-all">
                    {PLATFORM[a.platform]} · <span className="font-mono">{a.externalAdId}</span>
                  </span>
                }
                aside={
                  <span className="flex flex-wrap items-center gap-2">
                    {a.externalStatus ? `Status: ${a.externalStatus} (Manual)` : "Status desconhecido"}
                    <Link href={`/published/${a.id}`} className="font-semibold text-accent hover:underline">Ver resultado e análise →</Link>
                  </span>
                }
              >
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="text-xs">
                    <div className="font-semibold">{a.name ?? "Sem nome"}</div>
                    <div className="mt-1 text-soft">
                      Interno:{" "}
                      {a.variant ? (
                        <Link href={`/variants/${a.variant.id}`} className="break-all text-accent hover:underline">
                          {a.variant.adKey}
                        </Link>
                      ) : (
                        <span className="text-warn">não vinculado</span>
                      )}
                    </div>
                    <div className="mt-1 text-soft">Conta: {a.channelAccount?.name ?? "—"}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-soft">Gasto</div>
                        <strong>{a.insights.length ? formatMoney(spend, brand.currency) : "N/D"}</strong>
                      </div>
                      <div>
                        <div className="text-soft">Impressões</div>
                        <strong>{a.insights.length ? impressions.toLocaleString("en-US") : "N/D"}</strong>
                      </div>
                      <div>
                        <div className="text-soft">Cliques link</div>
                        <strong>{a.insights.length ? clicks.toLocaleString("en-US") : "N/D"}</strong>
                      </div>
                    </div>
                    <ActionForm action={linkPublishedAd.bind(null, a.id)} className="mt-3 flex items-end gap-2">
                      <Select label="Vincular a" name="variantId" defaultValue={a.variantId ?? ""} options={variantOptions} />
                      <Button type="submit">OK</Button>
                    </ActionForm>
                  </div>
                  <div className="lg:col-span-2">
                    <ActionForm action={saveDailyMetric.bind(null, a.id)} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-3 md:grid-cols-7">
                      <Field label="Dia" name="date" type="date" required />
                      <Field label={`Gasto (${brand.currency})`} name="spend" inputMode="decimal" required placeholder="0.00" />
                      <Field label="Impressões" name="impressions" type="number" min={0} required />
                      <Field label="Alcance" name="reach" type="number" min={0} />
                      <Field label="Cliques link" name="linkClicks" type="number" min={0} />
                      <Field label="Leads (Meta)" name="platformLeads" type="number" min={0} />
                      <Button type="submit">Salvar dia</Button>
                    </ActionForm>
                    {a.insights.length > 0 && (
                      <div className="mt-3 max-h-40 overflow-auto text-[11px] text-soft">
                        {a.insights.map((i) => (
                          <div key={i.id} className="flex justify-between gap-2 border-b border-line py-1">
                            <span>{i.date.toISOString().slice(0, 10)}</span>
                            <span>{formatMoney(toCents(i.spend), brand.currency)}</span>
                            <span>{i.impressions} impr.</span>
                            <span>{i.linkClicks ?? "—"} cliques</span>
                            <span>{i.platformLeads ?? "—"} leads Meta</span>
                            <span>{i.source === "MANUAL" ? "Manual" : i.source}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <Panel title="Cadastrar anúncio publicado" className="mt-4">
        <PublishedAdForm variants={variants} channels={channels} />
      </Panel>
    </>
  );
}
