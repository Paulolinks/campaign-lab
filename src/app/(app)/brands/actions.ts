"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errorMessage, type ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { decisionRulesSchema, DEFAULT_RULES } from "@/domain/ad-decision";
import { parseMoneyInput } from "@/domain/money-input";
import { slugify } from "@/domain/slug";
import { db } from "@/lib/db";
import { BRAND_COOKIE, requireEditor, requireOwnedBrand } from "@/lib/session";

const optional = z.string().trim().max(500).transform((v) => v || null);
const money = (label: string) =>
  z
    .string()
    .refine((v) => parseMoneyInput(v) !== undefined, `${label}: use um valor como 120.00`)
    .transform((v) => parseMoneyInput(v) ?? null);

const brandSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(120),
  industry: optional,
  domain: optional,
  serviceArea: optional,
  timezone: z.string().trim().min(1).max(64),
  currency: z.string().trim().length(3, "Moeda com 3 letras (ex.: USD).").toUpperCase(),
  forbiddenTerms: z.string().max(4000).transform((v) => v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)),
  notes: z.string().trim().max(5000).transform((v) => v || null),
  adDailyBudget: money("Orçamento por anúncio/dia"),
  targetCostPerAppointment: money("Custo máximo por visita"),
  maxDailySpend: money("Gasto máximo por dia"),
});

/** Rule inputs are named rule_<key>; blank keeps the default. */
function readRules(data: FormData) {
  const raw: Record<string, number> = {};
  for (const key of Object.keys(DEFAULT_RULES)) {
    const value = String(data.get(`rule_${key}`) ?? "").trim().replace(",", ".");
    if (value !== "") raw[key] = Number(value);
  }
  return decisionRulesSchema.safeParse(raw);
}

function readBrand(data: FormData) {
  return brandSchema.safeParse({
    name: data.get("name") ?? "",
    industry: data.get("industry") ?? "",
    domain: data.get("domain") ?? "",
    serviceArea: data.get("serviceArea") ?? "",
    timezone: data.get("timezone") || "America/New_York",
    currency: data.get("currency") || "USD",
    forbiddenTerms: data.get("forbiddenTerms") ?? "",
    notes: data.get("notes") ?? "",
    adDailyBudget: data.get("adDailyBudget") ?? "",
    targetCostPerAppointment: data.get("targetCostPerAppointment") ?? "",
    maxDailySpend: data.get("maxDailySpend") ?? "",
  });
}

export async function createBrand(_: ActionState, data: FormData): Promise<ActionState> {
  const user = await requireEditor();
  const parsed = readBrand(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const slug = slugify(parsed.data.name) || "marca";
  const exists = await db().brand.findUnique({ where: { workspaceId_slug: { workspaceId: user.workspaceId, slug } } });
  if (exists) return { error: "Já existe uma marca com esse nome." };

  const brand = await db().brand.create({ data: { ...parsed.data, slug, workspaceId: user.workspaceId } });
  await audit({ workspaceId: user.workspaceId, userId: user.id, brandId: brand.id, action: "brand.created", entity: "Brand", entityId: brand.id });
  (await cookies()).set(BRAND_COOKIE, brand.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(`/brands/${brand.id}`);
}

export async function updateBrand(brandId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const user = await requireEditor();
  await requireOwnedBrand(user, brandId);
  const parsed = readBrand(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const rules = readRules(data);
  if (!rules.success) return { error: `Regra da análise inválida: ${rules.error.issues[0].path.join(".")}` };
  try {
    await db().brand.update({ where: { id: brandId }, data: { ...parsed.data, decisionRules: rules.data } });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  await audit({ workspaceId: user.workspaceId, userId: user.id, brandId, action: "brand.updated", entity: "Brand", entityId: brandId });
  revalidatePath("/", "layout");
  return { ok: "Marca salva." };
}

const personaSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à persona.").max(120),
  content: z.string().trim().min(10, "Cole o texto da persona (ou carregue o arquivo .md).").max(500_000),
  source: z.string().trim().max(300).transform((v) => v || null),
});

/** Saves the persona as a new version; older versions stay available. */
export async function savePersona(brandId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const user = await requireEditor();
  await requireOwnedBrand(user, brandId);
  const parsed = personaSchema.safeParse({ name: data.get("name") ?? "", content: data.get("content") ?? "", source: data.get("source") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const last = await db().personaVersion.findFirst({ where: { brandId, name: parsed.data.name }, orderBy: { version: "desc" } });
  if (last && last.content === parsed.data.content) return { ok: `Sem mudanças: continua a versão ${last.version}.` };
  const version = (last?.version ?? 0) + 1;
  const persona = await db().personaVersion.create({
    data: { ...parsed.data, brandId, version, approved: data.get("approved") === "on", createdBy: user.id },
  });
  await audit({ workspaceId: user.workspaceId, userId: user.id, brandId, action: "persona.version_created", entity: "PersonaVersion", entityId: persona.id, data: { version } });
  revalidatePath(`/brands/${brandId}`);
  return { ok: `Persona "${persona.name}" salva como versão ${version}.` };
}

const channelSchema = z.object({
  platform: z.enum(["META", "FACEBOOK_ORGANIC", "INSTAGRAM_ORGANIC", "GOOGLE_ADS", "GOOGLE_BUSINESS_PROFILE", "TIKTOK", "YOUTUBE", "NEXTDOOR", "MARKETPLACE", "WEBSITE", "OTHER"]),
  name: z.string().trim().min(1, "Dê um nome à conta/página.").max(120),
  externalAccountId: z.string().trim().max(120).transform((v) => v || null),
  notes: z.string().trim().max(1000).transform((v) => v || null),
});

/** Registers an ad account / page by ID. It stays DISCONNECTED until a real API connection exists. */
export async function addChannel(brandId: string, _: ActionState, data: FormData): Promise<ActionState> {
  const user = await requireEditor();
  await requireOwnedBrand(user, brandId);
  const parsed = channelSchema.safeParse(Object.fromEntries(["platform", "name", "externalAccountId", "notes"].map((k) => [k, data.get(k) ?? ""])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await db().channelAccount.create({ data: { ...parsed.data, brandId } });
  } catch {
    return { error: "Essa conta já está cadastrada nesta marca." };
  }
  revalidatePath(`/brands/${brandId}`);
  return { ok: "Canal adicionado." };
}

export async function removeChannel(brandId: string, channelId: string) {
  const user = await requireEditor();
  await requireOwnedBrand(user, brandId);
  await db().channelAccount.deleteMany({ where: { id: channelId, brandId } });
  revalidatePath(`/brands/${brandId}`);
}
