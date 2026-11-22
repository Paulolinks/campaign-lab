"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ImportPlan } from "@/domain/campaign-import";
import { Button, Panel, Pill } from "../../ui";
import { confirmImport, previewImport, type CommitResponse } from "./actions";

const CHANGE_LABEL = {
  create: { label: "Novo", tone: "ok" },
  update: { label: "Atualizar (nova versão)", tone: "warn" },
  unchanged: { label: "Sem mudança", tone: "neutral" },
  conflict: { label: "Conflito", tone: "danger" },
} as const;

const FIELD_LABEL: Record<string, string> = {
  name: "nome", angle: "ângulo", format: "formato", funnelStage: "funil", hook: "hook", primaryText: "texto principal",
  headline: "headline", description: "descrição", cta: "CTA", visualDirection: "direção visual", imagePrompt: "prompt de imagem",
  videoScript: "roteiro", notes: "notas", creativeStatus: "status do criativo",
};

export function ImportClient({ brandName }: { brandName: string }) {
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<CommitResponse, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    reset();
    if (!file) return;
    if (!/\.txt$/i.test(file.name)) {
      setError("Use um arquivo .txt no formato CSCAMP/1.");
      return;
    }
    if (file.size > 2_000_000) {
      setError("Arquivo muito grande (limite: 2 MB).");
      return;
    }
    setFileName(file.name);
    setText(await file.text());
  }

  function reset() {
    setPlan(null);
    setError(null);
    setDone(null);
  }

  function preview() {
    reset();
    startTransition(async () => {
      const res = await previewImport(text);
      if ("error" in res) setError(res.error);
      else setPlan(res.plan);
    });
  }

  function commit() {
    startTransition(async () => {
      const res = await confirmImport(fileName || "texto-colado.txt", text);
      if (res.ok) {
        setDone(res);
        setPlan(null);
      } else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <TemplatePanel brandName={brandName} />
      <Panel title="2. Escolha o arquivo que a IA criou" aside={<Pill>CSCAMP/1</Pill>}>
        <label className="grid min-h-40 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-[#3b5b6b] p-6 text-center hover:border-accent">
          <span className="text-4xl text-accent">↥</span>
          <strong>Selecione o TXT da campanha</strong>
          <span className="text-xs text-soft">Será importado na marca ativa: {brandName}. Nada é publicado.</span>
          <input type="file" accept=".txt,text/plain" onChange={onFile} className="mt-3 max-w-xs" aria-label="Arquivo TXT" />
        </label>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-soft">…ou cole o texto</summary>
          <textarea
            className="mt-2 font-mono text-xs"
            rows={10}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFileName("");
              reset();
            }}
            placeholder={"CSCAMP/1\nCAMPAIGN\nCAMPAIGN_KEY: ..."}
          />
        </details>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={preview} disabled={!text.trim() || pending}>
            {pending && !plan ? "Lendo…" : "Pré-visualizar"}
          </Button>
          {fileName && <span className="text-xs text-soft">{fileName}</span>}
        </div>
        {error && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </Panel>

      {done && (
        <Panel title="Importado como rascunho">
          <p>
            {done.created} anúncio(s) novo(s), {done.updated} atualizado(s), {done.unchanged} sem mudança.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {done.campaignIds.map((id, i) => (
              <Link key={id} href={`/campaigns/${id}`} className="rounded-[9px] border border-accent bg-accent px-3 py-2 font-semibold text-accent-ink">
                Abrir campanha {done.campaignIds.length > 1 ? i + 1 : ""}
              </Link>
            ))}
          </div>
        </Panel>
      )}

      {plan && <PlanView plan={plan} onCommit={commit} pending={pending} />}
    </div>
  );
}

function PlanView({ plan, onCommit, pending }: { plan: ImportPlan; onCommit: () => void; pending: boolean }) {
  const nothingToDo = plan.ok && plan.totals.create === 0 && plan.totals.update === 0;
  return (
    <Panel title="3. Confira antes de importar">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Campanhas", plan.totals.campaigns],
          ["Anúncios", plan.totals.ads],
          ["Novos", plan.totals.create],
          ["Atualizados", plan.totals.update],
          ["Sem mudança", plan.totals.unchanged],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl border border-line bg-surface2 p-3">
            <div className="text-[11px] text-soft">{label}</div>
            <div className="text-xl font-bold">{n}</div>
          </div>
        ))}
      </div>

      {plan.errors.length > 0 && (
        <div className="mt-4 rounded-lg border border-[#6b2f2f] bg-[#2a1717] p-3 text-sm">
          <strong className="text-danger">{plan.errors.length} erro(s) — corrija o arquivo:</strong>
          <ul className="mt-2 list-disc pl-5">
            {plan.errors.map((e, i) => (
              <li key={i}>
                Linha {e.line}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {[...plan.warnings, ...plan.campaigns.flatMap((c) => c.ads.flatMap((a) => a.warnings))].length > 0 && (
        <div className="mt-4 rounded-lg border border-[#635037] bg-[#34301f] p-3 text-sm text-[#ffdc9f]">
          <strong>Avisos (não bloqueiam):</strong>
          <ul className="mt-2 list-disc pl-5">
            {[...plan.warnings, ...plan.campaigns.flatMap((c) => c.ads.flatMap((a) => a.warnings))].map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {plan.campaigns.map((c) => (
        <div key={c.input.campaignKey} className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="break-all">{c.input.campaignKey}</strong>
            <Pill tone={c.exists ? "neutral" : "ok"}>{c.exists ? "Campanha existente" : "Campanha nova"}</Pill>
          </div>
          <p className="mt-1 text-sm text-soft">
            {c.input.name} · {c.input.service} · {c.input.objective} · Canais: {c.input.channels.join(", ") || "—"}
          </p>
          <p className="mt-1 text-sm">Hipótese: {c.input.hypothesis}</p>
          <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {c.ads.map((a) => (
              <li key={a.input.adKey} className="rounded-xl border border-line bg-surface2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="break-all font-mono text-xs">{a.input.adKey}</span>
                  <Pill tone={CHANGE_LABEL[a.change].tone}>{CHANGE_LABEL[a.change].label}</Pill>
                </div>
                <div className="mt-2 font-semibold">{a.input.headline}</div>
                <div className="text-xs text-accent">{a.input.angle.replaceAll("_", " ")}</div>
                <div className="mt-1 text-xs text-soft">
                  {a.input.format} · {a.input.funnelStage}
                </div>
                {a.changedFields.length > 0 && (
                  <div className="mt-2 text-xs text-warn">Muda: {a.changedFields.map((f) => FIELD_LABEL[f] ?? f).join(", ")}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={onCommit} disabled={!plan.ok || nothingToDo || pending}>
          {pending ? "Importando…" : "Importar como rascunho"}
        </Button>
        {nothingToDo && <span className="text-sm text-soft">Tudo já está importado e igual. Nada a fazer.</span>}
      </div>
    </Panel>
  );
}

/** Step 1: the AI template ("framework") to download or copy, personalized for the active brand. */
function TemplatePanel({ brandName }: { brandName: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy() {
    try {
      const res = await fetch("/api/import/template");
      if (!res.ok) throw new Error();
      await navigator.clipboard.writeText((await res.text()).trimStart() /* also drops the BOM */);
      setCopied("Copiado! Cole no ChatGPT ou no Claude.");
    } catch {
      setCopied("Não foi possível copiar. Use o botão Baixar.");
    }
  }

  return (
    <Panel title="1. Baixe o modelo para a IA" aside={`Personalizado para ${brandName}`}>
      <p className="text-sm text-soft">
        Entregue este modelo ao ChatGPT ou ao Claude e peça as propagandas (ex.: &quot;3 anúncios de mini split testando 3 ângulos&quot;). Ele já leva o nome da
        marca, a persona e os termos proibidos. A IA responde no formato certo; salve a resposta como .txt e importe abaixo.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href="/api/import/template"
          download
          className="inline-block rounded-[9px] border border-accent bg-accent px-3 py-2 font-semibold text-accent-ink hover:brightness-110"
        >
          ↓ Baixar modelo (.txt)
        </a>
        <Button type="button" onClick={copy}>
          Copiar modelo
        </Button>
        {copied && <span className="text-xs text-success">{copied}</span>}
      </div>
    </Panel>
  );
}
