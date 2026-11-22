import { options, PLATFORM } from "@/lib/labels";
import { ActionForm } from "../../action-form";
import { Button, Field, Select, TextArea } from "../../ui";
import { savePublishedAd } from "./actions";

export function PublishedAdForm({
  variants,
  channels,
  defaultVariantId,
}: {
  variants: { id: string; adKey: string }[];
  channels: { id: string; name: string; platform: string }[];
  defaultVariantId?: string;
}) {
  return (
    <ActionForm action={savePublishedAd} resetOnSuccess>
      <div className="grid gap-3 md:grid-cols-2">
        <Select label="Plataforma" name="platform" options={options(PLATFORM)} defaultValue="META" />
        <Field label="ID do anúncio na plataforma *" name="externalAdId" required placeholder="Ex.: 120210000000000000" hint="No Ads Manager: coluna 'ID do anúncio'." />
        <Select
          label="Anúncio interno (variante)"
          name="variantId"
          defaultValue={defaultVariantId ?? ""}
          options={[{ value: "", label: "— Ainda sem vínculo —" }, ...variants.map((v) => ({ value: v.id, label: v.adKey }))]}
        />
        <Select
          label="Conta / página"
          name="channelAccountId"
          options={[{ value: "", label: "— Não informada —" }, ...channels.map((c) => ({ value: c.id, label: `${c.name} (${PLATFORM[c.platform]})` }))]}
        />
        <Field label="ID da campanha na plataforma" name="externalCampaignId" />
        <Field label="ID do conjunto de anúncios" name="externalAdSetId" />
        <Field label="Nome do anúncio na plataforma" name="name" placeholder="Ex.: CS | MS | QUALITY | 2026-11 | A01" />
        <Field label="Posicionamento" name="placement" placeholder="Ex.: Feed, Reels, Stories" />
        <Field label="Status na plataforma (manual)" name="externalStatus" placeholder="Ex.: Ativo, Pausado, Em revisão" />
        <Field label="Data de publicação" name="publishedAt" type="date" />
        <div className="md:col-span-2">
          <Field label="Link do anúncio/post" name="url" type="url" placeholder="https://..." />
        </div>
        <div className="md:col-span-2">
          <TextArea label="Notas" name="notes" rows={2} />
        </div>
      </div>
      <p className="text-[11px] text-soft">O status e as métricas cadastrados aqui ficam marcados como &quot;Manual&quot;. A sincronização automática com a Meta Marketing API ainda não está conectada.</p>
      <Button type="submit" variant="primary">
        Salvar publicação
      </Button>
    </ActionForm>
  );
}
