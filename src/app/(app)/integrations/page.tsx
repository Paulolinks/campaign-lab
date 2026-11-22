import { META_PERMISSIONS } from "@/domain/meta-check";
import { maskSecret } from "@/domain/secret-box";
import { db } from "@/lib/db";
import { CONNECTION, formatDate, PLATFORM } from "@/lib/labels";
import { graphVersion, type MetaTestResult } from "@/lib/meta";
import { requireBrand } from "@/lib/session";
import { storageFor } from "@/providers/storage";
import { ActionForm } from "../../action-form";
import { Button, Field, PageHeader, Panel, Pill } from "../../ui";
import { removeMetaConnection, saveMetaConnection, testMeta } from "./actions";
import { SyncPanel } from "./sync-panel";

const PLANNED = [
    { name: "Site / Pixel / CAPI / GA4", phase: "Fase 3", text: "UTMs, formulário do site, eventos deduplicados e sessões agregadas." },
  { name: "WhatsApp Business Platform", phase: "Fase 3", text: "Somente API oficial em número elegível. Clique em botão de WhatsApp não é conversa confirmada." },
  { name: "Google Ads API", phase: "Fase 3", text: "Importar campanhas e métricas de Search. Acesso via projeto Google Cloud." },
  { name: "Marketplace", phase: "Manual", text: "Sem integração. Registro manual, respeitando as políticas atuais." },
];


const STEPS = [
  {
    title: "Token de acesso",
    where: "business.facebook.com → Configurações do negócio → Usuários → Usuários do sistema → seu usuário → Gerar novo token. Escolha o app, validade Nunca, e marque as permissões da lista ao lado.",
    link: "https://business.facebook.com/settings/system-users",
  },
  {
    title: "ID da conta de anúncios",
    where: "No Gerenciador de Anúncios, é o número que aparece no menu de contas (no endereço do site aparece como act=123...).",
    link: "https://adsmanager.facebook.com/adsmanager/",
  },
  {
    title: "ID da página",
    where: "Na página da Cool Season no Facebook → Sobre → Transparência da página → ID da página.",
    link: "https://business.facebook.com/settings/pages",
  },
  {
    title: "App Secret (opcional)",
    where: "developers.facebook.com → seu app → Configurações do app → Básico → Chave secreta do app. Deixa a conexão mais segura.",
    link: "https://developers.facebook.com/apps/",
  },
];

export default async function IntegrationsPage() {
  const { brand } = await requireBrand();
  const [channels, driveReady, conn, lastTest] = await Promise.all([
    db().channelAccount.findMany({ where: { brandId: brand.id }, orderBy: { platform: "asc" } }),
    storageFor("GOOGLE_DRIVE").isConfigured(),
    db().metaConnection.findUnique({ where: { brandId: brand.id } }),
    db().auditLog.findFirst({ where: { brandId: brand.id, action: "meta.connection_tested" }, orderBy: { createdAt: "desc" } }),
  ]);
  const test = conn && lastTest && lastTest.createdAt >= conn.updatedAt ? ((lastTest.data ?? null) as MetaTestResult | null) : null;
  const state = !conn ? "DISCONNECTED" : !test ? "CONFIGURING" : test.ok ? "CONNECTED" : "ERROR";

  return (
    <>
      <PageHeader eyebrow={brand.name} title="Integrações" subtitle="Conecte a Meta colando o token aqui. Nada aparece como conectado sem a Meta confirmar." />

      <section id="meta" className="mb-4 overflow-hidden rounded-[13px] border border-accent bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[#1a3040] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Conectar Facebook e Instagram (Meta)</h2>
            <p className="text-xs text-soft">Marca: {brand.name}. O token fica criptografado no servidor e nunca volta para a tela.</p>
          </div>
          <Pill tone={CONNECTION[state].tone}>{CONNECTION[state].label}</Pill>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_1fr]">
          <div>
            {conn && (
              <div className="mb-4 rounded-xl border border-line bg-[#0f1a28] p-3 text-sm">
                <div>
                  Token salvo: <span className="font-mono font-bold">{maskSecret(conn.tokenLast4)}</span>
                  {conn.appSecretEncrypted && <span className="ml-2 text-xs text-soft">+ App Secret salvo</span>}
                </div>
                <div className="text-xs text-soft">
                  Conta {conn.adAccountId} · Página {conn.pageId} · salvo em {formatDate(conn.updatedAt, brand.timezone)}
                </div>
              </div>
            )}
            <ActionForm action={saveMetaConnection}>
              <Field
                label={conn ? "Novo token de acesso (deixe vazio para manter o atual)" : "1. Token de acesso"}
                name="token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="Cole aqui o token (começa com EAA...)"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="2. ID da conta de anúncios" name="adAccountId" defaultValue={conn?.adAccountId ?? ""} placeholder="act_1234567890" required />
                <Field label="3. ID da página" name="pageId" defaultValue={conn?.pageId ?? ""} placeholder="1234567890" inputMode="numeric" required />
              </div>
              <Field label="4. App Secret (opcional)" name="appSecret" type="password" autoComplete="off" placeholder={conn?.appSecretEncrypted ? "Salvo. Deixe vazio para manter" : "Opcional"} />
              <Button type="submit" variant="primary" className="py-3 text-base">
                Salvar e testar conexão
              </Button>
            </ActionForm>
            {conn && (
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionForm action={testMeta} className="flex">
                  <Button type="submit">Testar de novo</Button>
                </ActionForm>
                <ActionForm action={removeMetaConnection} className="flex">
                  <Button type="submit" variant="danger">
                    Apagar token
                  </Button>
                </ActionForm>
              </div>
            )}

            {test && (
              <div className={`mt-4 rounded-xl border p-3 text-sm ${test.ok ? "border-[#2f5f58] bg-[#203c3a]" : "border-[#6b2f2f] bg-[#3a1d1d]"}`}>
                <div className="mb-1 text-[11px] text-soft">Último teste: {formatDate(lastTest!.createdAt, brand.timezone)} · Graph API {graphVersion()}</div>
                {test.ok ? (
                  <ul className="flex flex-col gap-1">
                    <li>✓ Token de <strong>{test.user}</strong></li>
                    <li>
                      {test.account.statusOk ? "✓" : "✕"} Conta <strong>{test.account.name}</strong> ({test.account.currency}) · {test.account.status}
                    </li>
                    <li>✓ Página <strong>{test.page.name}</strong></li>
                  </ul>
                ) : (
                  <p className="text-danger">
                    ✕ Parou em <strong>{test.step}</strong>: {test.message}
                  </p>
                )}
              </div>
            )}
            {test?.ok && test.account.currency !== brand.currency && (
              <p className="mt-3 text-xs text-warn">
                A conta de anúncios usa {test.account.currency} e a marca está em {brand.currency}. Os números da Meta ficam na moeda da conta.
              </p>
            )}
            {conn && <SyncPanel brandId={brand.id} timeZone={brand.timezone} />}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-soft">Onde pegar cada coisa</h3>
              <ol className="flex flex-col gap-3 text-sm">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-ink">{i + 1}</span>
                    <span>
                      <strong>{s.title}.</strong> <span className="text-[#c9d4e3]">{s.where}</span>{" "}
                      <a href={s.link} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                        Abrir ↗
                      </a>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-soft">Permissões do token</h3>
              <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                {META_PERMISSIONS.map((p) => {
                  const ok = test?.ok ? test.permissions.granted.includes(p.name) : null;
                  return (
                    <li key={p.name} className="flex items-start gap-2">
                      <span className={ok === null ? "text-soft" : ok ? "text-success" : "text-danger"}>{ok === null ? "○" : ok ? "✓" : "✕"}</span>
                      <span>
                        <span className="font-mono text-xs">{p.name}</span>
                        <span className="block text-[11px] text-soft">{p.use}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="text-[11px] text-soft">
              O app só lê da Meta: campanhas, números por dia e leads dos formulários. Criar anúncios na Meta vem depois, sempre pausados e só com o seu OK.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Armazenamento de mídia">
          <div className="flex flex-wrap gap-2">
            <Pill tone="ok">Servidor local: ativo</Pill>
            <Pill tone={driveReady ? "ok" : "neutral"}>Google Drive: {driveReady ? "conectado" : "não conectado"}</Pill>
          </div>
          <p className="mt-3 text-xs text-soft">
            Hoje os arquivos ficam no servidor. Quando o Drive for conectado, os arquivos serão enviados para lá e poderão sair do servidor (o banco guarda o ID do Drive).
          </p>
        </Panel>
        {PLANNED.map((p) => (
          <Panel key={p.name} title={p.name}>
            <div className="flex gap-2">
              <Pill tone="neutral">Não conectado</Pill>
              <Pill>{p.phase}</Pill>
            </div>
            <p className="mt-3 text-xs text-soft">{p.text}</p>
          </Panel>
        ))}
      </div>
      <Panel title={`Contas cadastradas em ${brand.name}`} className="mt-4">
        {channels.length === 0 ? (
          <p className="text-sm text-soft">Nenhuma conta. Cadastre em Marcas → {brand.name}.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {channels.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <strong>{c.name}</strong>
                <span className="text-soft">{PLATFORM[c.platform]}</span>
                <span className="font-mono text-xs">{c.externalAccountId ?? "sem ID"}</span>
                <Pill tone={CONNECTION[c.connectionStatus].tone}>{CONNECTION[c.connectionStatus].label}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
