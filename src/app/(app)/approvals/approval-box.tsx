import { APPROVAL, formatDate } from "@/lib/labels";
import { ActionForm } from "../../action-form";
import { Button, Pill, TextArea } from "../../ui";
import { approveVariant, rejectVariant, reopenVariant } from "./actions";

/** Approve / reject buttons for one ad. Approving does not publish anything on Meta. */
export function ApprovalBox({
  variantId,
  approvalStatus,
  approvalNote,
  approvalAt,
  timeZone,
}: {
  variantId: string;
  approvalStatus: string;
  approvalNote: string | null;
  approvalAt: Date | null;
  timeZone: string;
}) {
  const state = APPROVAL[approvalStatus];
  if (approvalStatus !== "PENDING") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={state.tone}>{state.label}</Pill>
          <span className="text-xs text-soft">em {formatDate(approvalAt, timeZone)}</span>
        </div>
        {approvalNote && <p className="text-sm text-[#c9d4e3]">“{approvalNote}”</p>}
        {approvalStatus === "APPROVED" && (
          <p className="text-xs text-soft">Pronto para publicar. Nada foi enviado para a Meta: crie o anúncio pausado no Gerenciador e cole o ID em &quot;Publicações reais&quot;.</p>
        )}
        <ActionForm action={reopenVariant.bind(null, variantId)}>
          <Button type="submit">Desfazer (voltar para aprovação)</Button>
        </ActionForm>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ActionForm action={approveVariant.bind(null, variantId)}>
        <TextArea label="Comentário (opcional)" name="note" rows={2} placeholder="Ex.: ok, mas trocar o vídeo depois" />
        <Button type="submit" variant="primary">✓ Aprovar</Button>
      </ActionForm>
      <ActionForm action={rejectVariant.bind(null, variantId)}>
        <TextArea label="Motivo da rejeição" name="note" rows={2} placeholder="Ex.: texto longo demais, gancho fraco" />
        <Button type="submit" variant="danger">✕ Rejeitar</Button>
      </ActionForm>
    </div>
  );
}
