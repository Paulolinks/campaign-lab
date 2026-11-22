import Link from "next/link";
import { notFound } from "next/navigation";
import { campaignFunnel } from "@/domain/campaign-funnel";
import { formatMoney, toCents } from "@/domain/metrics";
import { buildUtmUrl } from "@/domain/utm";
import { db } from "@/lib/db";
import { APPROVAL, formatDate, humanize, options, PLAN_STATUS, TEST_LABEL } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { ActionForm } from "../../../action-form";
import { Button, Detail, Field, PageHeader, Panel, Pill, Select } from "../../../ui";
import { updateCampaignLanding, updateCampaignStatus } from "../actions";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const campaign = await db().campaignPlan.findFirst({
    where: { id, brand: { workspaceId: user.workspaceId } },
    include: {
      brand: true,
      personaVersion: true,
      variants: {
        orderBy: { adKey: "asc" },
        include: {
          assets: { orderBy: { createdAt: "asc" }, take: 1 },
          _count: { select: { publishedAds: true, leads: true, assets: true } },
        },
      },
    },
  });
  if (!campaign) notFound();
  const APPOINTMENT = ["APPOINTMENT_SCHEDULED", "APPOINTMENT_COMPLETED", "ESTIMATE_SENT", "WON"] as const;
  const [spendRows, leadRows] = await Promise.all([
    db().dailyAdInsight.findMany({ where: { publishedAd: { variant: { campaignId: campaign.id } } }, select: { spend: true } }),
    db().lead.findMany({
      where: { campaignId: campaign.id, status: { not: "DISQUALIFIED" } },
      select: { status: true, statusChanges: { select: { to: true } }, _count: { select: { jobs: true } } },
    }),
  ]);
  const reachedVisit = (l: (typeof leadRows)[number]) =>
    APPOINTMENT.some((s) => l.status === s || l.statusChanges.some((c) => c.to === s));
  const spend = spendRows.reduce((s, r) => s + toCents(r.spend), 0);
  const funnel = campaignFunnel({
    ads: campaign.variants.length,
    approved: campaign.variants.filter((v) => v.approvalStatus === "APPROVED").length,
    published: campaign.variants.filter((v) => v._count.publishedAds > 0).length,
    spend,
    leads: leadRows.length,
    appointments: leadRows.filter(reachedVisit).length,
    won: leadRows.filter((l) => l.status === "WON" || l._count.jobs > 0).length,
  });
  const pending = campaign.variants.filter((v) => v.approvalStatus === "PENDING").length;
  const extra = Object.entries((campaign.extra ?? {}) as Record<string, string>);
  const exampleUtm = buildUtmUrl(campaign.landingUrl, { source: "facebook", medium: "paid_social", campaign: campaign.campaignKey, content: "AD_KEY" });

  return (
    <>
      <PageHeader
        eyebrow={`Campanha · ${campaign.brand.name}`}
        title={campaign.name}
        subtitle={<span className="break-all font-mono text-xs">{campaign.campaignKey}</span>}
        actions={<Pill tone={PLAN_STATUS[campaign.status].tone}>{PLAN_STATUS[campaign.status].label}</Pill>}
      />
      <Panel
        title="Funil desta campanha"
        aside={`Gasto ${formatMoney(spendRows.length ? spend : null, campaign.brand.currency)} · custo por lead ${formatMoney(funnel.costPerLead, campaign.brand.currency)} · custo por visita ${formatMoney(funnel.costPerAppointment, campaign.brand.currency)}`}
        className="mb-4"
      >
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {funnel.steps.map((s, i) => {
            const isNext = funnel.next.step === s.key;
            return (
              <li
                key={s.key}
                className={`relative rounded-xl border p-3 ${isNext ? "border-warn bg-[#3d3022]" : s.value > 0 ? "border-[#2f5f58] bg-[#203c3a]" : "border-line"}`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wide text-soft">
                  {i + 1}. {s.label}
                </div>
                <div className="mt-1 text-2xl font-bold">{s.value}</div>
                <div className="text-[10px] text-soft">{s.hint}</div>
                {isNext && <div className="mt-1 text-[10px] font-bold text-warn">◀ você está aqui</div>}
              </li>
            );
          })}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-bold text-warn">Próximo passo:</span>
          <span>{funnel.next.text}</span>
          {pending > 0 && (
            <Link href={`/manager?tab=ads&c=${campaign.id}`} className="font-semibold text-accent hover:underline">
              Aprovar {pending} anúncio(s) →
            </Link>
          )}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Hipótese e plano">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Detail label="Hipótese do teste">{campaign.hypothesis}</Detail>
            </div>
            <Detail label="Serviço">{humanize(campaign.service)}</Detail>
            <Detail label="Objetivo">{humanize(campaign.objective)}</Detail>
            <Detail label="Persona">
              {campaign.persona}
              {campaign.personaVersion ? ` (v${campaign.personaVersion.version})` : " — não cadastrada na marca"}
            </Detail>
            <Detail label="Variável testada">{humanize(campaign.testVariable)}</Detail>
            <Detail label="Canais">{campaign.channels.map(humanize).join(", ")}</Detail>
            <Detail label="Mercado">{campaign.market}</Detail>
            <Detail label="Destino / CTA">{humanize(campaign.ctaDestination)}</Detail>
            <Detail label="Orçamento por dia">{campaign.budgetPerDay ? `${campaign.brand.currency} ${campaign.budgetPerDay.toString()}` : (campaign.budgetNote ?? "N/D")}</Detail>
            <div className="sm:col-span-2">
              <Detail label="Landing page">
                <span className="break-all">{campaign.landingUrl}</span>
                {!exampleUtm && <span className="block text-xs text-warn">É um modelo ({"{{...}}"}). Troque pela URL real para gerar os links com UTM.</span>}
              </Detail>
            </div>
            {campaign.notes && (
              <div className="sm:col-span-2">
                <Detail label="Notas">{campaign.notes}</Detail>
              </div>
            )}
            {extra.map(([k, v]) => (
              <Detail key={k} label={humanize(k)}>
                {v}
              </Detail>
            ))}
          </div>
        </Panel>
        <Panel title="Status interno">
          <ActionForm action={updateCampaignStatus.bind(null, campaign.id)}>
            <Select label="Status" name="status" defaultValue={campaign.status} options={options(PLAN_STATUS)} />
            <Button type="submit">Salvar status</Button>
          </ActionForm>
          <div className="mt-6">
            <ActionForm action={updateCampaignLanding.bind(null, campaign.id)}>
              <Field
                label="Landing page (URL real)"
                name="landingUrl"
                type="url"
                required
                defaultValue={exampleUtm ? campaign.landingUrl : ""}
                placeholder="https://seusite.com/orcamento"
                hint="Usada para gerar os links com UTM de cada anúncio publicado."
              />
              <Button type="submit">Salvar landing page</Button>
            </ActionForm>
          </div>
          <div className="mt-5 text-xs text-soft">
            Criada em {formatDate(campaign.createdAt, campaign.brand.timezone)} · atualizada em {formatDate(campaign.updatedAt, campaign.brand.timezone)}
          </div>
        </Panel>
      </div>

      <h2 className="mb-3 mt-7 text-[15px] font-bold">
        Anúncios (variantes) <span className="ml-2 rounded-lg border border-[#426d6c] px-2 py-0.5 text-[10px] text-[#80d4c0]">{campaign.variants.length}</span>
      </h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {campaign.variants.map((v) => {
          const thumb = v.assets[0];
          return (
            <Link key={v.id} href={`/variants/${v.id}`} className="overflow-hidden rounded-xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-accent">
              <div className="relative grid h-36 place-items-center bg-[radial-gradient(circle_at_70%_10%,#2b706d,#1c3246_64%,#152034)]">
                {thumb?.kind === "IMAGE" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/media/${thumb.id}`} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                {thumb?.kind === "VIDEO" && <video src={`/api/media/${thumb.id}#t=0.5`} preload="metadata" muted className="absolute inset-0 h-full w-full object-cover" />}
                <span className="absolute left-2.5 top-2.5 rounded-md border border-[#34566b] bg-[#0b1b2ecc] px-2 py-1 text-[10px]">
                  {humanize(v.format)} · {v._count.assets} mídia(s)
                </span>
                {!thumb && <span className="text-xs text-soft">Sem mídia ainda</span>}
              </div>
              <div className="p-4">
                <div className="break-all font-mono text-[10px] text-soft">{v.adKey}</div>
                <div className="mt-1 font-bold">{v.name ?? v.headline}</div>
                <div className="mt-1 text-[11px] font-bold text-accent">{humanize(v.angle)}</div>
                <p className="mt-2 line-clamp-2 min-h-9 text-xs text-[#afbed2]">{v.headline}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                  <Pill tone={APPROVAL[v.approvalStatus].tone}>{APPROVAL[v.approvalStatus].label}</Pill>
                  <Pill tone={PLAN_STATUS[v.status].tone}>{PLAN_STATUS[v.status].label}</Pill>
                  {v.testLabel && <Pill tone={TEST_LABEL[v.testLabel].tone}>{TEST_LABEL[v.testLabel].label}</Pill>}
                  <Pill>{v._count.publishedAds} publicação(ões)</Pill>
                  <Pill>v{v.version}</Pill>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
