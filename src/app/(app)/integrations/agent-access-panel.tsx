import { maskSecret } from "@/domain/secret-box";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { ActionForm } from "../../action-form";
import { Button, Panel, Pill } from "../../ui";
import { revokeAgentKey } from "./actions";
import { AgentKeyForm } from "./agent-key-form";

/** Integrações → Acesso do Claude: read-only key for the marketing analyst (spec 05). */
export async function AgentAccessPanel({ workspaceId, timeZone }: { workspaceId: string; timeZone: string }) {
  const keys = await db().agentAccessKey.findMany({ where: { workspaceId, revokedAt: null }, orderBy: { createdAt: "desc" } });
  return (
    <Panel title="Acesso do Claude (só leitura)" className="mb-4">
      <p className="mb-3 text-sm text-[#c9d4e3]">
        Deixa o Claude ler campanhas, textos dos anúncios, números por dia e o funil dos leads para fazer as análises. Ele não muda nada e não vê nome, telefone nem
        e-mail dos clientes.
      </p>
      {keys.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2 text-sm">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-[#0f1a28] p-3">
              <span>
                <strong>{k.name}</strong> <span className="font-mono text-xs">{maskSecret(k.last4)}</span>{" "}
                <Pill tone={k.lastUsedAt ? "ok" : "neutral"}>{k.lastUsedAt ? `usada em ${formatDate(k.lastUsedAt, timeZone)}` : "ainda não usada"}</Pill>
              </span>
              <ActionForm action={revokeAgentKey.bind(null, k.id)} className="flex">
                <Button type="submit" variant="danger">
                  Revogar
                </Button>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
      <AgentKeyForm />
    </Panel>
  );
}
