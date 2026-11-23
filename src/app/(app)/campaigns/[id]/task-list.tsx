"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { CopyButton } from "../../copy-button";
import { MediaUploader } from "../../media-uploader";
import { toggleCampaignTask } from "../actions";

/** The media an ad needs, shown right inside the task that asks for it. */
export type TaskMedia = {
  variantId: string;
  brandId: string;
  code: string;
  isVideo: boolean;
  what: string;
  spec: string | null;
  prompt: string | null;
  script: string | null;
  files: number;
};
export type Task = { text: string; media: TaskMedia | null };

/** The owner's checklist for a campaign plan (TASKS field). Checking is saved; a media task opens what to make. */
export function TaskList({ campaignId, tasks, done }: { campaignId: string; tasks: Task[]; done: string[] }) {
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState<string | null>(tasks.find((t) => t.media && !done.includes(t.text))?.text ?? null);
  const [checked, setChecked] = useOptimistic(new Set(done), (state: Set<string>, change: { task: string; on: boolean }) => {
    const next = new Set(state);
    if (change.on) next.add(change.task);
    else next.delete(change.task);
    return next;
  });
  const count = tasks.filter((t) => checked.has(t.text)).length;

  return (
    <div>
      <div className="mb-2 text-xs text-soft">
        {count} de {tasks.length} feitas
      </div>
      <ul className="flex flex-col gap-2">
        {tasks.map(({ text, media }) => {
          const on = checked.has(text);
          const expanded = open === text && media;
          return (
            <li key={text} className={`rounded-xl border ${on ? "border-[#2f5f58] bg-[#203c3a]" : "border-line bg-[#0f1a28]"}`}>
              <div className="flex items-start gap-3 p-3 text-sm">
                <input
                  type="checkbox"
                  aria-label={text}
                  checked={on}
                  onChange={(e) => {
                    const value = e.target.checked;
                    startTransition(async () => {
                      setChecked({ task: text, on: value });
                      await toggleCampaignTask(campaignId, text, value);
                    });
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#5cd8bc]"
                />
                <span className={`flex-1 ${on ? "text-soft line-through" : ""}`}>{text}</span>
                {media && (
                  <button type="button" onClick={() => setOpen(expanded ? null : text)} className="shrink-0 rounded-lg border border-accent px-3 py-1.5 text-xs font-bold text-accent">
                    {expanded ? "Fechar" : media.isVideo ? "Ver o vídeo a fazer" : "Ver a imagem a fazer"}
                  </button>
                )}
              </div>
              {expanded && (
                <div className="grid gap-4 border-t border-line p-4 lg:grid-cols-[1.4fr_1fr]">
                  <div className="flex flex-col gap-3 text-sm">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-soft">{media.isVideo ? "Faça este vídeo" : "Faça esta imagem"} · anúncio {media.code}</div>
                      <p className="mt-1 whitespace-pre-wrap">{media.what}</p>
                    </div>
                    {media.spec && (
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-soft">Tamanho e tipo</div>
                        <p className="mt-1">{media.spec}</p>
                      </div>
                    )}
                    {media.prompt && (
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-soft">Prompt para o gerador (copie e cole)</div>
                        <pre className="mt-1 whitespace-pre-wrap break-words rounded-lg border border-line bg-[#0b1420] p-3 font-mono text-xs">{media.prompt}</pre>
                        <div className="mt-2">
                          <CopyButton text={media.prompt} label="Copiar prompt" />
                        </div>
                      </div>
                    )}
                    {media.script && (
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-soft">Roteiro</div>
                        <p className="mt-1 whitespace-pre-wrap">{media.script}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-soft">Subir aqui quando estiver pronta</div>
                    <MediaUploader brandId={media.brandId} variantId={media.variantId} />
                    <p className="text-xs text-soft">
                      {media.files ? `Este anúncio já tem ${media.files} arquivo(s). ` : "Ainda sem arquivo. "}
                      <Link href={`/variants/${media.variantId}`} className="font-semibold text-accent hover:underline">
                        Abrir o anúncio {media.code}
                      </Link>
                    </p>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
