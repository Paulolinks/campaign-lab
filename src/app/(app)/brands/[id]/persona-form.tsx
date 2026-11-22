"use client";

import { useRef } from "react";
import type { ActionState } from "@/lib/action-state";
import { ActionForm } from "../../../action-form";
import { Button, Field, TextArea } from "../../../ui";

/** Persona editor. A .md/.txt file can be loaded into the text box (read in the browser, saved as text). */
export function PersonaForm({
  action,
  defaults,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  defaults: { name: string; content: string };
}) {
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const sourceRef = useRef<HTMLInputElement>(null);

  async function loadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !contentRef.current) return;
    contentRef.current.value = await file.text();
    if (sourceRef.current) sourceRef.current.value = file.name;
  }

  return (
    <ActionForm action={action}>
      <Field label="Nome da persona" name="name" defaultValue={defaults.name} required placeholder="Ex.: The Careful Homeowner" />
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-soft">Carregar de arquivo (.md ou .txt)</span>
        <input type="file" accept=".md,.txt,text/markdown,text/plain" onChange={loadFile} />
      </label>
      <TextArea label="Texto da persona / brand kit" name="content" ref={contentRef} rows={10} defaultValue={defaults.content} required />
      <Field label="Origem" name="source" ref={sourceRef} placeholder="Nome do arquivo ou documento" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="approved" /> Aprovada pelo dono da marca
      </label>
      <Button type="submit" variant="primary">
        Salvar nova versão
      </Button>
    </ActionForm>
  );
}
