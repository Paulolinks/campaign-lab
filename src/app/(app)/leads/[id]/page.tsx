import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, formatPercent, toCents } from "@/domain/metrics";
import { db } from "@/lib/db";
import { CONFIDENCE, ESTIMATE_STATUS, formatDate, LEAD_STATUS, options, PLATFORM } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { ActionForm } from "../../../action-form";
import { Button, Detail, Field, PageHeader, Panel, Pill, Select, Table } from "../../../ui";
import { addEstimate, addJob, changeLeadStatus } from "../actions";

const LOST_REASONS = [
  { value: "", label: "—" },
  { value: "price", label: "Preço" },
  { value: "scope", label: "Escopo" },
  { value: "competitor", label: "Concorrente" },
  { value: "timing", label: "Momento" },
  { value: "no_reply", label: "Sem resposta" },
  { value: "other", label: "Outro" },
];

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const lead = await db().lead.findFirst({
    where: { id, brand: { workspaceId: user.workspaceId } },
    include: {
      brand: true,
      campaign: true,
      variant: true,
      publishedAd: true,
      estimates: { orderBy: { createdAt: "desc" } },
      jobs: { orderBy: { createdAt: "desc" } },
      statusChanges: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!lead) notFound();
  const cur = lead.brand.currency;
  const tz = lead.brand.timezone;
  const revenue = lead.jobs.reduce((s, j) => s + toCents(j.contractAmount), 0);
  const costs = lead.jobs.reduce((s, j) => s + toCents(j.directCosts), 0);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/leads" className="hover:underline">
            ← Leads · {lead.brand.name}
          </Link>
        }
        title={lead.name}
        subtitle={`Entrou em ${formatDate(lead.createdAt, tz)}`}
        actions={<Pill tone={LEAD_STATUS[lead.status].tone}>{LEAD_STATUS[lead.status].label}</Pill>}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Contato e origem">
          <div className="grid grid-cols-2 gap-4">
            <Detail label="Telefone">{lead.phone}</Detail>
            <Detail label="E-mail">{lead.email}</Detail>
            <Detail label="Serviço">{lead.requestedService}</Detail>
            <Detail label="CEP / área">{lead.zip}</Detail>
            <Detail label="Urgência">{lead.urgency}</Detail>
            <Detail label="Prioridade">{lead.primaryPriority}</Detail>
            <Detail label="Origem">{lead.sourcePlatform ? PLATFORM[lead.sourcePlatform] : "Desconhecida"}</Detail>
            <Detail label="Certeza">{CONFIDENCE[lead.sourceConfidence]}</Detail>
            <Detail label="Campanha">{lead.campaign ? <Link className="text-accent hover:underline" href={`/campaigns/${lead.campaign.id}`}>{lead.campaign.name}</Link> : null}</Detail>
            <Detail label="Anúncio">{lead.variant ? <Link className="break-all text-accent hover:underline" href={`/variants/${lead.variant.id}`}>{lead.variant.adKey}</Link> : null}</Detail>
            <Detail label="Anúncio publicado">{lead.publishedAd ? `${PLATFORM[lead.publishedAd.platform]} ${lead.publishedAd.externalAdId}` : null}</Detail>
            <Detail label="UTM">{[lead.utmSource, lead.utmMedium, lead.utmCampaign, lead.utmContent].filter(Boolean).join(" / ")}</Detail>
            <div className="col-span-2">
              <Detail label="Notas">{lead.notes}</Detail>
            </div>
          </div>
        </Panel>

        <Panel title="Etapa do funil">
          <ActionForm action={changeLeadStatus.bind(null, lead.id)}>
            <Select label="Etapa" name="status" defaultValue={lead.status} options={options(LEAD_STATUS)} />
            <Select label="Motivo da perda (se perdido)" name="reasonLost" defaultValue={lead.reasonLost ?? ""} options={LOST_REASONS} />
            <Button type="submit">Salvar etapa</Button>
          </ActionForm>
          <div className="mt-4 text-xs">
            {lead.statusChanges.map((c) => (
              <div key={c.id} className="flex justify-between gap-2 border-b border-line py-1.5">
                <span>
                  {c.from ? `${LEAD_STATUS[c.from].label} → ` : ""}
                  {LEAD_STATUS[c.to].label}
                </span>
                <span className="text-soft">{formatDate(c.createdAt, tz)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Resultado financeiro">
          <div className="grid grid-cols-2 gap-4">
            <Detail label="Receita contratada">{formatMoney(lead.jobs.length ? revenue : null, cur)}</Detail>
            <Detail label="Custos diretos">{formatMoney(lead.jobs.length ? costs : null, cur)}</Detail>
            <Detail label="Margem bruta">{formatMoney(lead.jobs.length ? revenue - costs : null, cur)}</Detail>
            <Detail label="Margem %">{formatPercent(revenue ? (revenue - costs) / revenue : null)}</Detail>
          </div>
          <p className="mt-3 text-[11px] text-soft">Antes da mídia. O custo de anúncio entra no dashboard. Receita contratada não é dinheiro recebido.</p>
        </Panel>

        <Panel title="Orçamentos" className="xl:col-span-3">
          {lead.estimates.length > 0 && (
            <Table head={["Valor", "Status", "Enviado em", "Notas"]}>
              {lead.estimates.map((e) => (
                <tr key={e.id}>
                  <td>{formatMoney(toCents(e.amount), cur)}</td>
                  <td>{ESTIMATE_STATUS[e.status]}</td>
                  <td>{e.sentAt ? formatDate(e.sentAt, tz) : "—"}</td>
                  <td>{e.notes ?? "—"}</td>
                </tr>
              ))}
            </Table>
          )}
          <ActionForm action={addEstimate.bind(null, lead.id)} className="mt-3 grid items-end gap-3 md:grid-cols-5" resetOnSuccess>
            <Field label={`Valor (${cur})`} name="amount" inputMode="decimal" required placeholder="0.00" />
            <Select label="Status" name="status" defaultValue="SENT" options={options(ESTIMATE_STATUS)} />
            <Field label="Enviado em" name="sentAt" type="date" />
            <Field label="Notas" name="notes" />
            <Button type="submit">Adicionar orçamento</Button>
          </ActionForm>
        </Panel>

        <Panel title="Contrato fechado" className="xl:col-span-3">
          {lead.jobs.length > 0 && (
            <Table head={["Valor do contrato", "Custos diretos", "Margem", "Fechado em", "Notas"]}>
              {lead.jobs.map((j) => (
                <tr key={j.id}>
                  <td>{formatMoney(toCents(j.contractAmount), cur)}</td>
                  <td>{formatMoney(toCents(j.directCosts), cur)}</td>
                  <td>{formatMoney(toCents(j.contractAmount) - toCents(j.directCosts), cur)}</td>
                  <td>{formatDate(j.closeDate, tz)}</td>
                  <td>{j.notes ?? "—"}</td>
                </tr>
              ))}
            </Table>
          )}
          <ActionForm action={addJob.bind(null, lead.id)} className="mt-3 grid items-end gap-3 md:grid-cols-6" resetOnSuccess>
            <Field label={`Valor do contrato (${cur})`} name="contractAmount" inputMode="decimal" required placeholder="0.00" />
            <Field label="Custos diretos" name="directCosts" inputMode="decimal" placeholder="0.00" hint="Equipamento, material, mão de obra, terceiros, comissão" />
            <Field label="Fechado em" name="closeDate" type="date" />
            <Select label="Orçamento" name="estimateId" options={[{ value: "", label: "—" }, ...lead.estimates.map((e) => ({ value: e.id, label: formatMoney(toCents(e.amount), cur) }))]} />
            <Field label="Notas" name="notes" />
            <Button type="submit" variant="primary">
              Registrar contrato
            </Button>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
