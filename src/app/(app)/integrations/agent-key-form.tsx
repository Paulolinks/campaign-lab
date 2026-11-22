"use client";

import { useActionState, useState } from "react";
import { Button } from "../../ui";
import { createAgentKey, type AgentKeyState } from "./actions";

/** Creates the analyst key and shows it once, with a copy button (spec 05). */
export function AgentKeyForm() {
  const [state, action, pending] = useActionState<AgentKeyState, FormData>(createAgentKey, null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Criando…" : "Criar chave de acesso do Claude"}
        </Button>
      </form>
      {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      {state?.key && (
        <div className="rounded-xl border border-warn bg-[#2b2418] p-3 text-sm">
          <p className="mb-2 text-warn">{state.ok}</p>
          <code data-testid="agent-key" className="block break-all rounded-md bg-[#0f1a28] p-2 font-mono text-xs text-white">
            {state.key}
          </code>
          <Button
            type="button"
            className="mt-2"
            onClick={() => navigator.clipboard?.writeText(state.key!).then(() => setCopied(true), () => setCopied(false))}
          >
            {copied ? "Copiado ✓" : "Copiar"}
          </Button>
        </div>
      )}
    </div>
  );
}
