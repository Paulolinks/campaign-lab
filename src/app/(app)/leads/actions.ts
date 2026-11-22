"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getBrandContext, requireUser } from "@/lib/session";

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const money = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (use 1500.00).");
const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "DISQUALIFIED", "APPOINTMENT_SCHEDULED", "APPOINTMENT_COMPLETED", "ESTIMATE_SENT", "WON", "LOST"] as const;

const leadSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(200),
  phone: text(40),
  email: text(200),
  requestedService: text(120),
  zip: text(20),
  urgency: text(60),
  primaryPriority: text(60),
  notes: text(5000),
  sourcePlatform: z.enum(["", "META", "FACEBOOK_ORGANIC", "INSTAGRAM_ORGANIC", "GOOGLE_ADS", "GOOGLE_BUSINESS_PROFILE", "TIKTOK", "YOUTUBE", "NEXTDOOR", "MARKETPLACE", "WEBSITE", "OTHER"]).transform((v) => v || null),
  sourceConfidence: z.enum(["CONFIRMED", "PROBABLE", "UNKNOWN"]),
  campaignId: text(64),
  variantId: text(64),
  publishedAdId: text(64),
  utmSource: text(120),
  utmMedium: text(120),
  utmCampaign: text(200),
  utmContent: text(200),
});
const LEAD_FIELDS = Object.keys(leadSchema.shape);

/** Sales role can register leads; viewers cannot. */
async function requireSalesWriter() {
  const user = await requireUser();
  if (user.role === "VIEWER") throw new Error("Sem permissão.");
  return user;
}

export async function createLead(_: ActionState, data: FormData): Promise<ActionState> {
  const user = await requireSalesWriter();
  const { brand } = await getBrandContext(user);
  if (!brand) return { error: "Crie uma marca primeiro." };
  const parsed = leadSchema.safeParse(Object.fromEntries(LEAD_FIELDS.map((k) => [k, data.get(k) ?? (k === "sourceConfidence" ? "UNKNOWN" : "")])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const p = parsed.data;

  // Attribution ids must belong to this brand. A variant implies its campaign.
  if (p.variantId) {
    const v = await db().adVariant.findFirst({ where: { id: p.variantId, brandId: brand.id } });
    if (!v) return { error: "Anúncio inválido." };
    p.campaignId = v.campaignId;
  }
  if (p.campaignId && !(await db().campaignPlan.findFirst({ where: { id: p.campaignId, brandId: brand.id } }))) return { error: "Campanha inválida." };
  if (p.publishedAdId && !(await db().publishedAd.findFirst({ where: { id: p.publishedAdId, brandId: brand.id } }))) return { error: "Publicação inválida." };

  // Possible duplicate: same phone or email in this brand. We warn, never merge automatically.
  const duplicate = (p.phone || p.email)
    ? await db().lead.findFirst({ where: { brandId: brand.id, OR: [...(p.phone ? [{ phone: p.phone }] : []), ...(p.email ? [{ email: p.email }] : [])] } })
    : null;
  if (duplicate && data.get("confirmDuplicate") !== "on") {
    return { error: `Já existe um lead com esse telefone/e-mail (${duplicate.name}). Marque "é outra pessoa" para criar mesmo assim, ou abra o lead existente.` };
  }

  const lead = await db().lead.create({ data: { ...p, brandId: brand.id, statusChanges: { create: { to: "NEW", userId: user.id } } } });
  await audit({ workspaceId: user.workspaceId, userId: user.id, brandId: brand.id, action: "lead.created", entity: "Lead", entityId: lead.id });
  redirect(`/leads/${lead.id}`);
}

async function ownedLead(leadId: string) {
  const user = await requireSalesWriter();
  const lead = await db().lead.findFirst({ where: { id: leadId, brand: { workspaceId: user.workspaceId } } });
  if (!lead) throw new Error("Lead não encontrado.");
  return { user, lead };
}

/** Moving a deal between stages never creates a new lead; every change is logged. */
export async function changeLeadStatus(leadId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const { user, lead } = await ownedLead(leadId);
  const to = z.enum(LEAD_STATUSES).safeParse(data.get("status"));
  if (!to.success) return { error: "Status inválido." };
  const reasonLost = to.data === "LOST" ? String(data.get("reasonLost") ?? "") || null : lead.reasonLost;
  if (to.data === lead.status && reasonLost === lead.reasonLost) return { ok: "Sem mudança." };
  await db().$transaction([
    db().lead.update({ where: { id: leadId }, data: { status: to.data, reasonLost } }),
    db().leadStatusChange.create({ data: { leadId, from: lead.status, to: to.data, userId: user.id } }),
  ]);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: "Etapa atualizada." };
}

export async function addEstimate(leadId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const { user, lead } = await ownedLead(leadId);
  const parsed = z
    .object({ amount: money, status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]), sentAt: z.string(), notes: text(2000) })
    .safeParse({ amount: data.get("amount") ?? "", status: data.get("status") ?? "SENT", sentAt: data.get("sentAt") ?? "", notes: data.get("notes") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { sentAt, ...rest } = parsed.data;
  await db().estimate.create({ data: { ...rest, leadId, sentAt: sentAt ? new Date(`${sentAt}T12:00:00Z`) : rest.status === "SENT" ? new Date() : null } });
  if (["NEW", "CONTACTED", "QUALIFIED", "APPOINTMENT_SCHEDULED", "APPOINTMENT_COMPLETED"].includes(lead.status) && rest.status === "SENT") {
    await db().$transaction([
      db().lead.update({ where: { id: leadId }, data: { status: "ESTIMATE_SENT" } }),
      db().leadStatusChange.create({ data: { leadId, from: lead.status, to: "ESTIMATE_SENT", userId: user.id } }),
    ]);
  }
  revalidatePath(`/leads/${leadId}`);
  return { ok: "Orçamento registrado." };
}

/** Records a won contract with its direct costs, so margin is real, not just revenue. */
export async function addJob(leadId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const { user, lead } = await ownedLead(leadId);
  const parsed = z
    .object({ contractAmount: money, directCosts: money.or(z.literal("").transform(() => "0")), closeDate: z.string(), estimateId: text(64), notes: text(2000) })
    .safeParse(Object.fromEntries(["contractAmount", "directCosts", "closeDate", "estimateId", "notes"].map((k) => [k, data.get(k) ?? ""])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { closeDate, estimateId, ...rest } = parsed.data;
  if (estimateId && !(await db().estimate.findFirst({ where: { id: estimateId, leadId } }))) return { error: "Orçamento inválido." };
  await db().job.create({ data: { ...rest, leadId, estimateId, closeDate: closeDate ? new Date(`${closeDate}T12:00:00Z`) : new Date() } });
  if (lead.status !== "WON") {
    await db().$transaction([
      db().lead.update({ where: { id: leadId }, data: { status: "WON" } }),
      db().leadStatusChange.create({ data: { leadId, from: lead.status, to: "WON", userId: user.id } }),
    ]);
  }
  await audit({ workspaceId: user.workspaceId, userId: user.id, brandId: lead.brandId, action: "job.created", entity: "Lead", entityId: leadId, data: rest });
  revalidatePath(`/leads/${leadId}`);
  return { ok: "Contrato registrado." };
}
