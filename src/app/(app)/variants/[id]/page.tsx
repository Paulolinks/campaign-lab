import Link from "next/link";
import { notFound } from "next/navigation";
import { adSetSetup, adSetup, asExtra, campaignSetup, listItems } from "@/domain/meta-setup";
import { costPer, formatMoney, toCents } from "@/domain/metrics";
import { db } from "@/lib/db";
import { APPROVAL, formatDate, humanize, options, PLAN_STATUS, PLATFORM, TEST_LABEL, UPLOAD_STATUS } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { ActionForm } from "../../../action-form";
import { Button, Detail, Empty, PageHeader, Panel, Pill, Select, Table } from "../../../ui";
import { updateVariantStatus } from "../../campaigns/actions";
import { AdPreview } from "../../ad-preview";
import { CopyButton } from "../../copy-button";
import { MetaLevel } from "../../meta-setup-view";
import { ApprovalBox } from "../../approvals/approval-box";
import { MediaGrid } from "../../media-grid";
import { MediaUploader } from "../../media-uploader";
import { PublishedAdForm } from "../../published/published-form";

export default async function VariantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const v = await db().adVariant.findFirst({
    where: { id, brand: { workspaceId: user.workspaceId } },
    include: {
      brand: true,
      campaign: true,
      assets: { orderBy: { createdAt: "asc" } },
      publishedAds: { include: { insights: true, channelAccount: true }, orderBy: { createdAt: "asc" } },
      versions: { orderBy: { version: "desc" }, include: { importBatch: { select: { fileName: true } } } },
      leads: { select: { status: true } },
    },
  });
  if (!v) notFound();
  const [variants, channels, history] = await Promise.all([
    db().adVariant.findMany({ where: { brandId: v.brandId }, select: { id: true, adKey: true }, orderBy: { adKey: "asc" } }),
    db().channelAccount.findMany({ where: { brandId: v.brandId }, select: { id: true, name: true, platform: true } }),
    db().auditLog.findMany({ where: { entity: "AdVariant", entityId: v.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const spend = v.publishedAds.flatMap((p) => p.insights).reduce((s, i) => s + toCents(i.spend), 0);
  const leads = v.leads.filter((l) => l.status !== "DISQUALIFIED").length;
  const tz = v.brand.timezone;
  const adExtra = asExtra(v.extra);
  const campaignExtra = asExtra(v.campaign.extra);
  const metaCampaign = campaignSetup(campaignExtra, v.campaign.ctaDestination);
  const metaAdSet = adSetSetup(adExtra);
  const metaAd = adSetup(adExtra);
  const form = listItems(adExtra.FORM_QUESTIONS);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/campaigns/${v.campaignId}`} className="hover:underline">
            ← {v.campaign.name}
          </Link>
        }
        title={v.name ?? v.headline}
        subtitle={<span className="break-all font-mono text-xs">{v.adKey} · versão {v.version}</span>}
        actions={
          <>
            <Pill tone={APPROVAL[v.approvalStatus].tone}>{APPROVAL[v.approvalStatus].label}</Pill>
            <Pill tone={PLAN_STATUS[v.status].tone}>{PLAN_STATUS[v.status].label}</Pill>
            {v.testLabel && <Pill tone={TEST_LABEL[v.testLabel].tone}>{TEST_LABEL[v.testLabel].label}</Pill>}
          </>
        }
      />

      <Panel title="Faça esta mídia" aside="Depois de pronta, suba aqui mesmo" className="mb-4">
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-4">
            <Detail label="O que mostrar">{v.visualDirection}</Detail>
            {adExtra.MEDIA_SPEC && <Detail label="Tamanho e tipo">{adExtra.MEDIA_SPEC}</Detail>}
            {v.imagePrompt && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-soft">Prompt para o gerador de imagem (copie e cole)</div>
                <pre className="mt-1 whitespace-pre-wrap break-words rounded-lg border border-line bg-[#0b1420] p-3 font-mono text-xs">{v.imagePrompt}</pre>
                <div className="mt-2">
                  <CopyButton text={v.imagePrompt} label="Copiar prompt" />
                </div>
              </div>
            )}
            {v.videoScript && <Detail label="Roteiro do vídeo">{v.videoScript}</Detail>}
          </div>
          <div className="flex flex-col gap-3">
            <MediaUploader brandId={v.brandId} variantId={v.id} />
            <p className="text-xs text-soft">{v.assets.length ? `${v.assets.length} arquivo(s) já enviado(s). Veja em "Mídia" mais abaixo.` : "Nenhuma mídia enviada ainda."}</p>
          </div>
        </div>
      </Panel>

      {(metaAdSet.length > 0 || metaAd.length > 0 || form.length > 0) && (
        <Panel title="Configuração na Meta" aside="Como montar este anúncio no Gerenciador, campo por campo" className="mb-4">
          <div className="flex flex-col gap-3">
            <MetaLevel step="1 · CAMPANHA" title={campaignExtra.META_CAMPAIGN_NAME ?? v.campaign.name} rows={metaCampaign.filter((r) => r.key !== "META_CAMPAIGN_NAME")} />
            <MetaLevel step="2 · CONJUNTO" title={metaAdSet.find((r) => r.key === "ADSET_NAME")?.value ?? v.adKey} rows={metaAdSet.filter((r) => r.key !== "ADSET_NAME")} indent={1} />
            <MetaLevel
              step="3 · ANÚNCIO"
              title={v.name ?? v.adKey}
              rows={[
                ...metaAd,
                { key: "HEADLINE", label: "Título", value: v.headline },
                ...(v.description ? [{ key: "DESCRIPTION", label: "Descrição", value: v.description }] : []),
                { key: "CTA", label: "Botão", value: humanize(v.cta) },
                ...(form.length ? [{ key: "FORM", label: "Perguntas do formulário", value: form.map((q) => `• ${q}`).join("\n") }] : []),
              ]}
              indent={2}
            />
          </div>
        </Panel>
      )}

      <Panel title="Como fica no Facebook e aprovação" aside="Aprovar não publica nada na Meta" className="mb-4">
        <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
          <AdPreview
            ad={{
              brandName: v.brand.name,
              domain: v.brand.domain,
              primaryText: v.primaryText,
              headline: v.headline,
              description: v.description,
              cta: v.cta,
              hook: v.hook,
              media: v.assets[0] ?? null,
            }}
          />
          <ApprovalBox variantId={v.id} approvalStatus={v.approvalStatus} approvalNote={v.approvalNote} approvalAt={v.approvalAt} timeZone={tz} />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Conteúdo do anúncio" aside="Texto para o cliente final (como foi escrito)">
          <div className="grid gap-4">
            <Detail label="Hook">{v.hook}</Detail>
            <Detail label="Headline">{v.headline}</Detail>
            <Detail label="Texto principal">{v.primaryText}</Detail>
            <Detail label="Descrição">{v.description}</Detail>
            <Detail label="CTA">{humanize(v.cta)}</Detail>
            <Detail label="Notas">{v.notes}</Detail>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Identificação do teste">
            <div className="grid grid-cols-2 gap-4">
              <Detail label="Ângulo">{humanize(v.angle)}</Detail>
              <Detail label="Formato">{humanize(v.format)}</Detail>
              <Detail label="Funil">{humanize(v.funnelStage)}</Detail>
              <Detail label="Persona">{v.campaign.persona}</Detail>
              <Detail label="Objetivo">{humanize(v.campaign.objective)}</Detail>
              <Detail label="Plataformas planejadas">{v.campaign.channels.map(humanize).join(", ")}</Detail>
              <div className="col-span-2">
                <Detail label="Hipótese">{v.campaign.hypothesis}</Detail>
              </div>
            </div>
          </Panel>
          <Panel title="Status e rótulo do teste">
            <ActionForm action={updateVariantStatus.bind(null, v.id)}>
              <Select label="Status" name="status" defaultValue={v.status} options={options(PLAN_STATUS)} />
              <Select label="Rótulo do teste" name="testLabel" defaultValue={v.testLabel ?? ""} options={[{ value: "", label: "— Sem rótulo —" }, ...options(TEST_LABEL)]} />
              <p className="text-[11px] text-soft">Não declare vencedor só por likes ou CTR: olhe leads qualificados, propostas e margem.</p>
              <Button type="submit">Salvar</Button>
            </ActionForm>
          </Panel>
          <Panel title="Resultado (dados cadastrados)">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Gasto">{formatMoney(v.publishedAds.length ? spend : null, v.brand.currency)}</Detail>
              <Detail label="Leads válidos (CRM)">{String(leads)}</Detail>
              <Detail label="CPL real">{formatMoney(costPer(spend, leads), v.brand.currency)}</Detail>
              <Detail label="Publicações">{String(v.publishedAds.length)}</Detail>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Mídia (vídeos e imagens)" aside="Arquivos privados — só usuários logados veem" className="mt-4">
        <div>
          {v.assets.length === 0 ? (
            <Empty>Nenhum arquivo neste anúncio ainda. Suba lá em cima, em &quot;Faça esta mídia&quot;.</Empty>
          ) : (
            <MediaGrid
              items={v.assets.map((a) => ({ id: a.id, kind: a.kind, fileName: a.fileName, bytes: Number(a.bytes), uploadStatusLabel: UPLOAD_STATUS[a.uploadStatus].label }))}
            />
          )}
        </div>
      </Panel>

      <Panel title="Publicações reais (anúncios na plataforma)" aside="O ID externo é a chave de atribuição" className="mt-4">
        {v.publishedAds.length === 0 ? (
          <Empty>Nenhum anúncio real vinculado. Quando publicar no Facebook Ads, cadastre o ID do anúncio abaixo.</Empty>
        ) : (
          <Table head={["Plataforma", "ID externo", "Nome", "Status (fonte)", "Gasto", "Link com UTM"]}>
            {v.publishedAds.map((p) => (
              <tr key={p.id}>
                <td>{PLATFORM[p.platform]}</td>
                <td className="break-all font-mono">{p.externalAdId}</td>
                <td>{p.name ?? "—"}</td>
                <td>{p.externalStatus ? `${p.externalStatus} (Manual)` : "—"}</td>
                <td>{p.insights.length ? formatMoney(p.insights.reduce((s, i) => s + toCents(i.spend), 0), v.brand.currency) : "N/D"}</td>
                <td className="max-w-80 break-all text-[10px] text-soft">{p.utmUrl ?? "Landing page é um modelo — sem UTM"}</td>
              </tr>
            ))}
          </Table>
        )}
        <details className="mt-4">
          <summary className="cursor-pointer font-semibold text-accent">+ Vincular anúncio publicado</summary>
          <div className="mt-3">
            <PublishedAdForm variants={variants} channels={channels} defaultVariantId={v.id} />
          </div>
        </details>
      </Panel>

      <Panel title="Histórico" className="mt-4">
        <Table head={["Quando", "O quê", "Detalhe"]}>
          {v.versions.map((ver) => (
            <tr key={ver.id}>
              <td>{formatDate(ver.createdAt, tz)}</td>
              <td>Versão {ver.version} do conteúdo</td>
              <td>{ver.importBatch ? `Importado de ${ver.importBatch.fileName}` : "Edição"}</td>
            </tr>
          ))}
          {history.map((h) => (
            <tr key={h.id}>
              <td>{formatDate(h.createdAt, tz)}</td>
              <td>{h.action === "variant.status_changed" ? "Status alterado" : h.action === "variant.approval_changed" ? "Aprovação" : h.action}</td>
              <td className="break-all text-soft">{JSON.stringify(h.data)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
