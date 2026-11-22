"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireEditor } from "@/lib/session";

/**
 * Owner approval of an ad (variant). Nothing is sent to Meta here: approving only marks the ad as
 * ready to publish; rejecting archives it with the reason, so the next round can learn from it.
 */
async function decide(variantId: string, decision: "APPROVED" | "REJECTED" | "PENDING", note: string | null): Promise<ActionState> {
  const user = await requireEditor();
  const variant = await db().adVariant.findFirst({ where: { id: variantId, brand: { workspaceId: user.workspaceId } } });
  if (!variant) return { error: "Anúncio não encontrado." };

  const status =
    decision === "APPROVED" ? (variant.status === "DRAFT" || variant.status === "ARCHIVED" ? "READY" : variant.status)
    : decision === "REJECTED" ? "ARCHIVED"
    : "DRAFT";

  await db().adVariant.update({
    where: { id: variantId },
    data: { approvalStatus: decision, approvalNote: note, approvalAt: decision === "PENDING" ? null : new Date(), status },
  });
  await audit({
    workspaceId: user.workspaceId, userId: user.id, brandId: variant.brandId, action: "variant.approval_changed", entity: "AdVariant", entityId: variantId,
    data: { from: variant.approvalStatus, to: decision, note },
  });
  revalidatePath("/", "layout");
  return {
    ok: decision === "APPROVED" ? "Aprovado. Está pronto para publicar." : decision === "REJECTED" ? "Rejeitado e arquivado." : "Voltou para aprovação.",
  };
}

export async function approveVariant(variantId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const note = String(data.get("note") ?? "").trim().slice(0, 2000) || null;
  return decide(variantId, "APPROVED", note);
}

export async function rejectVariant(variantId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const note = String(data.get("note") ?? "").trim().slice(0, 2000);
  if (!note) return { error: "Escreva o motivo (ajuda a próxima rodada de anúncios)." };
  return decide(variantId, "REJECTED", note);
}

export async function reopenVariant(variantId: string): Promise<ActionState> {
  return decide(variantId, "PENDING", null);
}
