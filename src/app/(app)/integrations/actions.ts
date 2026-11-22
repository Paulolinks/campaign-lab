"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { normalizeAdAccountId, normalizePageId } from "@/domain/meta-check";
import type { ActionState } from "@/lib/action-state";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { metaCredentials, sealSecret, testMetaConnection, type MetaTestResult } from "@/lib/meta";
import { isSyncRunning, nextMetricsKind, runMetaSync } from "@/lib/meta-sync-service";
import { requireBrand, requireEditor } from "@/lib/session";

async function recordTest(brandId: string, user: { id: string; workspaceId: string }, result: MetaTestResult, accountId: string) {
  const status = result.ok ? "CONNECTED" : "ERROR";
  const lastError = result.ok ? null : `${result.step}: ${result.message}`.slice(0, 500);
  const name = result.ok ? result.account.name : "Conta de anúncios Meta";
  await db().channelAccount.upsert({
    where: { brandId_platform_externalAccountId: { brandId, platform: "META", externalAccountId: accountId } },
    create: { brandId, platform: "META", name, externalAccountId: accountId, connectionStatus: status, lastSyncAt: new Date(), lastError },
    update: { name, connectionStatus: status, lastSyncAt: new Date(), lastError },
  });
  await audit({ workspaceId: user.workspaceId, userId: user.id, brandId, action: "meta.connection_tested", entity: "Integration", entityId: "META", data: result });
}

function message(result: MetaTestResult): ActionState {
  if (!result.ok) return { error: `Salvo, mas não conectou (${result.step}): ${result.message}` };
  return result.permissions.missing.length
    ? { ok: `Conectado. Faltam permissões no token: ${result.permissions.missing.join(", ")}.` }
    : { ok: "Conectado. Token, conta de anúncios e página conferidos." };
}

/** Saves the pasted Meta credentials (token and app secret encrypted) and tests them right away. */
export async function saveMetaConnection(_: ActionState, data: FormData): Promise<ActionState> {
  const user = await requireEditor();
  const { brand } = await requireBrand();
  const existing = await db().metaConnection.findUnique({ where: { brandId: brand.id } });

  const token = String(data.get("token") ?? "").trim();
  const appSecret = String(data.get("appSecret") ?? "").trim();
  const adAccountId = normalizeAdAccountId(String(data.get("adAccountId") ?? ""));
  const pageId = normalizePageId(String(data.get("pageId") ?? ""));
  if (!token && !existing) return { error: "Cole o token de acesso." };
  if (token && (token.length < 20 || /\s/.test(token))) return { error: "Esse token não parece certo. Copie de novo, sem espaços." };
  if (!adAccountId) return { error: "ID da conta de anúncios: só números (ex.: 1234567890 ou act_1234567890)." };
  if (!pageId) return { error: "ID da página: só números." };

  const fields = {
    adAccountId,
    pageId,
    savedById: user.id,
    ...(token ? { tokenEncrypted: sealSecret(token), tokenLast4: token.slice(-4) } : {}),
    ...(appSecret ? { appSecretEncrypted: sealSecret(appSecret) } : {}),
  };
  if (existing) await db().metaConnection.update({ where: { brandId: brand.id }, data: fields });
  else await db().metaConnection.create({ data: { brandId: brand.id, ...fields, tokenEncrypted: fields.tokenEncrypted!, tokenLast4: fields.tokenLast4! } });
  await audit({
    workspaceId: user.workspaceId, userId: user.id, brandId: brand.id, action: "meta.connection_saved", entity: "Integration", entityId: "META",
    data: { adAccountId, pageId, tokenChanged: !!token, appSecretChanged: !!appSecret },
  });

  const creds = (await metaCredentials(brand.id))!;
  const result = await testMetaConnection(creds);
  await recordTest(brand.id, user, result, adAccountId);
  revalidatePath("/", "layout");
  return message(result);
}

export async function testMeta(): Promise<ActionState> {
  const user = await requireEditor();
  const { brand } = await requireBrand();
  const creds = await metaCredentials(brand.id);
  if (!creds) return { error: "Salve o token primeiro." };
  const result = await testMetaConnection(creds);
  await recordTest(brand.id, user, result, normalizeAdAccountId(creds.adAccountId) ?? creds.adAccountId);
  revalidatePath("/", "layout");
  return message(result);
}

export async function removeMetaConnection(): Promise<ActionState> {
  const user = await requireEditor();
  const { brand } = await requireBrand();
  await db().metaConnection.deleteMany({ where: { brandId: brand.id } });
  await db().channelAccount.updateMany({ where: { brandId: brand.id, platform: "META" }, data: { connectionStatus: "DISCONNECTED" } });
  await audit({ workspaceId: user.workspaceId, userId: user.id, brandId: brand.id, action: "meta.connection_removed", entity: "Integration", entityId: "META" });
  revalidatePath("/", "layout");
  return { ok: "Token apagado do app." };
}

async function startSync(kind: "FULL" | "INCREMENTAL" | null): Promise<ActionState> {
  const user = await requireEditor();
  const { brand } = await requireBrand();
  if (!(await db().metaConnection.findUnique({ where: { brandId: brand.id }, select: { id: true } }))) return { error: "Salve o token primeiro." };
  const metricsKind = kind ?? (await nextMetricsKind(brand.id));
  if (await isSyncRunning(brand.id, metricsKind)) return { error: "Já está sincronizando. Espere terminar e atualize a página." };
  // The history can take minutes: answer now and keep reading from Meta after the response.
  after(async () => {
    const metrics = await runMetaSync(brand.id, { kind: metricsKind, trigger: "MANUAL", userId: user.id });
    if (metrics.ok) await runMetaSync(brand.id, { kind: "LEADS", trigger: "MANUAL", userId: user.id });
  });
  revalidatePath("/", "layout");
  return { ok: metricsKind === "FULL" ? "Começou a puxar todo o histórico. Pode levar alguns minutos; atualize a página para ver." : "Sincronizando. Atualize a página em alguns segundos." };
}

/** "Sincronizar agora": recent days (or the whole history the first time), then the form leads. Only reads from Meta. */
export async function syncMetaNow(): Promise<ActionState> {
  return startSync(null);
}

/** "Recarregar todo o histórico": reads everything Meta keeps again (replaces, never adds twice). */
export async function syncMetaFull(): Promise<ActionState> {
  return startSync("FULL");
}
