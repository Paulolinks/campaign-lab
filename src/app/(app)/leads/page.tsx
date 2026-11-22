import Link from "next/link";
import { db } from "@/lib/db";
import { CONFIDENCE, formatDate, LEAD_STATUS, options, PLATFORM } from "@/lib/labels";
import { requireBrand } from "@/lib/session";
import { ActionForm } from "../../action-form";
import { Button, Empty, Field, PageHeader, Panel, Pill, Select, Table, TextArea } from "../../ui";
import { createLead } from "./actions";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { brand } = await requireBrand();
  const { status } = await searchParams;
  const filter = status && status in LEAD_STATUS ? (status as keyof typeof LEAD_STATUS) : undefined;
  const [leads, counts, campaigns, variants, published] = await Promise.all([
    db().lead.findMany({
      where: { brandId: brand.id, ...(filter ? { status: filter as never } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { campaign: { select: { name: true } }, variant: { select: { adKey: true } }, jobs: true },
    }),
    db().lead.groupBy({ by: ["status"], where: { brandId: brand.id }, _count: true }),
    db().campaignPlan.findMany({ where: { brandId: brand.id }, select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
    db().adVariant.findMany({ where: { brandId: brand.id }, select: { id: true, adKey: true }, orderBy: { adKey: "asc" } }),
    db().publishedAd.findMany({ where: { brandId: brand.id }, select: { id: true, externalAdId: true, platform: true } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageHeader eyebrow={brand.name} title="Leads e vendas" subtitle="Contatos reais, do primeiro contato ao contrato. Mudar a etapa não cria lead novo." />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/leads" className={`rounded-full border px-3 py-1 text-xs ${!filter ? "border-accent text-accent" : "border-line text-soft"}`}>
          Todos ({counts.reduce((s, c) => s + c._count, 0)})
        </Link>
        {Object.entries(LEAD_STATUS).map(([k, v]) => (
          <Link key={k} href={`/leads?status=${k}`} className={`rounded-full border px-3 py-1 text-xs ${filter === k ? "border-accent text-accent" : "border-line text-soft"}`}>
            {v.label} ({countOf(k)})
          </Link>
        ))}
      </div>

      <Panel>
        {leads.length === 0 ? (
          <Empty>Nenhum lead {filter ? "nesta etapa" : "ainda"}. Cadastre abaixo.</Empty>
        ) : (
          <Table head={["Lead", "Entrou em", "Origem", "Campanha / anúncio", "Serviço", "Etapa", "Contrato"]}>
            {leads.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link href={`/leads/${l.id}`} className="font-semibold text-accent hover:underline">
                    {l.name}
                  </Link>
                </td>
                <td>{formatDate(l.createdAt, brand.timezone)}</td>
                <td>
                  {l.sourcePlatform ? PLATFORM[l.sourcePlatform] : "Desconhecida"}
                  <div className="text-[10px] text-soft">Atribuição: {CONFIDENCE[l.sourceConfidence]}</div>
                </td>
                <td>
                  {l.campaign?.name ?? "—"}
                  <div className="break-all font-mono text-[10px] text-soft">{l.variant?.adKey}</div>
                </td>
                <td>{l.requestedService ?? "—"}</td>
                <td>
                  <Pill tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Pill>
                </td>
                <td>{l.jobs.length ? `${brand.currency} ${l.jobs.reduce((s, j) => s + Number(j.contractAmount), 0).toFixed(2)}` : "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Novo lead" className="mt-4">
        <ActionForm action={createLead}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Nome *" name="name" required />
            <Field label="Telefone" name="phone" type="tel" />
            <Field label="E-mail" name="email" type="email" />
            <Field label="Serviço pedido" name="requestedService" placeholder="Ex.: Mini split" />
            <Field label="CEP / área" name="zip" />
            <Field label="Urgência" name="urgency" placeholder="Ex.: esta semana" />
            <Field label="Prioridade do cliente" name="primaryPriority" placeholder="qualidade, garantia, preço…" hint="Só o que o cliente disse. Não inferir." />
            <Select label="Origem" name="sourcePlatform" options={[{ value: "", label: "Desconhecida" }, ...options(PLATFORM)]} />
            <Select label="Certeza da origem" name="sourceConfidence" defaultValue="UNKNOWN" options={options(CONFIDENCE)} />
            <Select label="Campanha" name="campaignId" options={[{ value: "", label: "—" }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]} />
            <Select label="Anúncio interno" name="variantId" options={[{ value: "", label: "—" }, ...variants.map((v) => ({ value: v.id, label: v.adKey }))]} />
            <Select label="Anúncio publicado" name="publishedAdId" options={[{ value: "", label: "—" }, ...published.map((p) => ({ value: p.id, label: `${PLATFORM[p.platform]} ${p.externalAdId}` }))]} />
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-soft">UTMs (se vieram do formulário do site)</summary>
            <div className="mt-2 grid gap-3 md:grid-cols-4">
              <Field label="utm_source" name="utmSource" />
              <Field label="utm_medium" name="utmMedium" />
              <Field label="utm_campaign" name="utmCampaign" />
              <Field label="utm_content" name="utmContent" />
            </div>
          </details>
          <TextArea label="Notas" name="notes" rows={2} />
          <label className="flex items-center gap-2 text-xs text-soft">
            <input type="checkbox" name="confirmDuplicate" /> Telefone/e-mail igual a outro lead, mas é outra pessoa
          </label>
          <Button type="submit" variant="primary">
            Cadastrar lead
          </Button>
        </ActionForm>
      </Panel>
    </>
  );
}
