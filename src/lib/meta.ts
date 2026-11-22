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

/** A Meta Graph API error with its code, so callers can tell a rate limit from an expired token. */
export class MetaApiError extends Error {
  constructor(message: string, readonly code: number | null = null, readonly subcode: number | null = null) {
    super(message);
    this.name = "MetaApiError";
  }
}

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number } };

async function graphFetch<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new MetaApiError("Sem resposta da Meta. Confira a internet do servidor e tente de novo.");
  }
  const body = (await res.json().catch(() => ({}))) as T & GraphError;
  // Graph error messages never include the token; we keep only the message and codes.
  if (!res.ok || body.error) throw new MetaApiError(body.error?.message ?? `Meta respondeu ${res.status}`, body.error?.code ?? null, body.error?.error_subcode ?? null);
  return body;
}

function graphUrl(creds: MetaCredentials, path: string, params: Record<string, string> = {}): string {
  const q = new URLSearchParams({ ...params, access_token: creds.token });
  if (creds.appSecret) q.set("appsecret_proof", createHmac("sha256", creds.appSecret).update(creds.token).digest("hex"));
  return `${GRAPH}/${graphVersion()}/${path}?${q}`;
}

export async function graphGet<T>(creds: MetaCredentials, path: string, fields?: string): Promise<T> {
  return graphFetch<T>(graphUrl(creds, path, fields ? { fields } : {}));
}

/** Reads every page of a Graph API list (follows paging.next). Only GET: nothing is changed on Meta. */
export async function graphList<T>(creds: MetaCredentials, path: string, params: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  let url: string | undefined = graphUrl(creds, path, { limit: "500", ...params });
  for (let page = 0; url && page < 1000; page++) {
    const body: { data?: T[]; paging?: { next?: string } } = await graphFetch(url);
    out.push(...(body.data ?? []));
    url = body.paging?.next;
  }
  return out;
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
