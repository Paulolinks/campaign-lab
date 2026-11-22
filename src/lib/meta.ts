import "server-only";
import { createHmac } from "node:crypto";
import { accountStatus, checkPermissions, normalizeAdAccountId } from "@/domain/meta-check";
import { decryptSecret, deriveKey, encryptSecret } from "@/domain/secret-box";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Meta Graph API access. Credentials are pasted in the app (Integrações) and stored encrypted per brand.
 * The token never goes back to the browser: the page only gets the last 4 characters.
 */
const GRAPH = "https://graph.facebook.com";

function encryptionKey(): Buffer {
  return deriveKey(process.env.META_ENCRYPTION_KEY?.trim() || env("BETTER_AUTH_SECRET"), "meta-connection");
}

export const sealSecret = (plain: string) => encryptSecret(plain, encryptionKey());

export type MetaCredentials = { token: string; appSecret: string | null; adAccountId: string; pageId: string };

export async function metaCredentials(brandId: string): Promise<MetaCredentials | null> {
  const c = await db().metaConnection.findUnique({ where: { brandId } });
  if (!c) return null;
  const key = encryptionKey();
  return {
    token: decryptSecret(c.tokenEncrypted, key),
    appSecret: c.appSecretEncrypted ? decryptSecret(c.appSecretEncrypted, key) : null,
    adAccountId: c.adAccountId,
    pageId: c.pageId,
  };
}

export function graphVersion(): string {
  const v = process.env.META_GRAPH_VERSION?.trim();
  return v && /^v\d+\.\d+$/.test(v) ? v : "v23.0";
}

async function graphGet<T>(creds: MetaCredentials, path: string, fields?: string): Promise<T> {
  const params = new URLSearchParams({ access_token: creds.token });
  if (fields) params.set("fields", fields);
  if (creds.appSecret) params.set("appsecret_proof", createHmac("sha256", creds.appSecret).update(creds.token).digest("hex"));
  let res: Response;
  try {
    res = await fetch(`${GRAPH}/${graphVersion()}/${path}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new Error("Sem resposta da Meta. Confira a internet do servidor e tente de novo.");
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  // Graph error messages never include the token; we keep only the message.
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `Meta respondeu ${res.status}`);
  return body;
}

export type MetaTestResult =
  | { ok: false; step: string; message: string }
  | {
      ok: true;
      user: string;
      account: { id: string; name: string; currency: string; timezone: string; status: string; statusOk: boolean };
      page: { id: string; name: string };
      permissions: { granted: string[]; missing: string[] };
    };

/** Calls Meta with the saved token: who am I, which permissions, the ad account and the page. Only reads. */
export async function testMetaConnection(creds: MetaCredentials): Promise<MetaTestResult> {
  const accountId = normalizeAdAccountId(creds.adAccountId);
  if (!accountId) return { ok: false, step: "Configuração", message: "O ID da conta de anúncios precisa ser um número (ex.: act_1234567890)." };
  let step = "Token";
  try {
    const me = await graphGet<{ id: string; name?: string }>(creds, "me", "id,name");
    step = "Permissões";
    const perms = await graphGet<{ data: { permission: string; status: string }[] }>(creds, "me/permissions");
    step = "Conta de anúncios";
    const acc = await graphGet<{ name: string; currency: string; timezone_name: string; account_status: number }>(
      creds,
      accountId,
      "name,currency,timezone_name,account_status",
    );
    step = "Página";
    const page = await graphGet<{ id: string; name: string }>(creds, creds.pageId, "id,name");
    const status = accountStatus(acc.account_status);
    return {
      ok: true,
      user: me.name ?? me.id,
      account: { id: accountId, name: acc.name, currency: acc.currency, timezone: acc.timezone_name, status: status.label, statusOk: status.ok },
      page: { id: page.id, name: page.name },
      permissions: checkPermissions(perms.data ?? []),
    };
  } catch (err) {
    return { ok: false, step, message: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
