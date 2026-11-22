import { db } from "@/lib/db";
import { CONNECTION, formatDate, options, PLATFORM } from "@/lib/labels";
import { requireOwnedBrand, requireUser } from "@/lib/session";
import { ActionForm } from "../../../action-form";
import { Button, Empty, Field, PageHeader, Panel, Pill, Select, Table } from "../../../ui";
import { addChannel, removeChannel, savePersona, updateBrand } from "../actions";
import { BrandFields } from "../brand-fields";
import { PersonaForm } from "./persona-form";

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const brand = await requireOwnedBrand(user, id);
  const [personas, channels] = await Promise.all([
    db().personaVersion.findMany({ where: { brandId: id }, orderBy: [{ name: "asc" }, { version: "desc" }] }),
    db().channelAccount.findMany({ where: { brandId: id }, orderBy: { createdAt: "asc" } }),
  ]);
  const latest = personas[0];

  return (
    <>
      <PageHeader eyebrow="Marca" title={brand.name} subtitle={brand.industry ?? undefined} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Dados da marca">
          <ActionForm action={updateBrand.bind(null, id)}>
            <BrandFields brand={brand} />
            <Button type="submit" variant="primary">
              Salvar
            </Button>
          </ActionForm>
        </Panel>

        <Panel title="Persona / Brand kit" aside="Cada salvamento cria uma versão nova">
          <PersonaForm action={savePersona.bind(null, id)} defaults={{ name: latest?.name ?? "", content: latest?.content ?? "" }} />
          {personas.length > 0 && (
            <div className="mt-5">
              <Table head={["Persona", "Versão", "Origem", "Aprovada", "Criada em"]}>
                {personas.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>v{p.version}</td>
                    <td className="break-all">{p.source ?? "—"}</td>
                    <td>{p.approved ? <Pill tone="ok">Sim</Pill> : <Pill>Não</Pill>}</td>
                    <td>{formatDate(p.createdAt, brand.timezone)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </Panel>

        <Panel title="Canais e contas de anúncio" aside="Cadastrar o ID não conecta a API" className="xl:col-span-2">
          {channels.length === 0 ? (
            <Empty>Nenhum canal cadastrado. Adicione a página do Facebook, o perfil do Instagram, a conta de anúncios etc.</Empty>
          ) : (
            <Table head={["Plataforma", "Nome", "ID externo", "Conexão", "Última sincronização", ""]}>
              {channels.map((c) => (
                <tr key={c.id}>
                  <td>{PLATFORM[c.platform]}</td>
                  <td>{c.name}</td>
                  <td className="break-all font-mono">{c.externalAccountId ?? "—"}</td>
                  <td>
                    <Pill tone={CONNECTION[c.connectionStatus].tone}>{CONNECTION[c.connectionStatus].label}</Pill>
                  </td>
                  <td>{c.lastSyncAt ? formatDate(c.lastSyncAt, brand.timezone) : "Nunca"}</td>
                  <td>
                    <form action={removeChannel.bind(null, id, c.id)}>
                      <button className="cursor-pointer text-danger hover:underline">Remover</button>
                    </form>
                  </td>
                </tr>
              ))}
            </Table>
          )}
          <div className="mt-5">
            <ActionForm action={addChannel.bind(null, id)} className="grid items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]" resetOnSuccess>
              <Select label="Plataforma" name="platform" options={options(PLATFORM)} />
              <Field label="Nome" name="name" required placeholder="Ex.: Cool Season Ads" />
              <Field label="ID da conta / página" name="externalAccountId" placeholder="Ex.: act_123456789" />
              <Button type="submit">Adicionar</Button>
            </ActionForm>
          </div>
        </Panel>
      </div>
    </>
  );
}
