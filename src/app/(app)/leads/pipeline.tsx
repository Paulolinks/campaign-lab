"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type DragEvent } from "react";
import { changeLeadStatus } from "./actions";

export type PipelineLead = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  createdAt: string;
  source: string | null;
  isNew: boolean;
};

const DAY = 86_400_000;

function age(iso: string, now: number) {
  const ms = now - new Date(iso).getTime();
  if (ms < 60 * 60_000) return `há ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (ms < DAY) return `há ${Math.round(ms / 3_600_000)} h`;
  return `há ${Math.round(ms / DAY)} d`;
}

/**
 * Leads as a board: one column per stage. Drag a card (computer) or use its stage menu (phone) to move it;
 * the move goes through the same action as the lead page, so it is logged in the lead history.
 */
export function Pipeline({ leads, stages, now }: { leads: PipelineLead[]; stages: { key: string; label: string }[]; now: number }) {
  const router = useRouter();
  const [items, setItems] = useState(leads);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const move = (id: string, to: string) => {
    const lead = items.find((l) => l.id === id);
    if (!lead || lead.status === to) return;
    setItems((all) => all.map((l) => (l.id === id ? { ...l, status: to } : l)));
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("status", to);
      const res = await changeLeadStatus(id, null, data);
      if (res?.error) {
        setItems((all) => all.map((l) => (l.id === id ? { ...l, status: lead.status } : l)));
        setError(res.error);
      }
      router.refresh();
    });
  };

  const onDrop = (stage: string) => (e: DragEvent) => {
    e.preventDefault();
    setOver(null);
    move(e.dataTransfer.getData("text/plain"), stage);
  };

  return (
    <div>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <div className={`flex gap-3 overflow-x-auto pb-2 ${pending ? "opacity-80" : ""}`}>
        {stages.map((s) => {
          const cards = items.filter((l) => l.status === s.key);
          return (
            <section
              key={s.key}
              aria-label={s.label}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s.key);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={onDrop(s.key)}
              className={`flex w-64 shrink-0 flex-col rounded-[13px] border bg-surface ${over === s.key ? "border-accent" : "border-line"}`}
            >
              <h3 className="flex items-center justify-between border-b border-line px-3 py-2 text-xs font-bold uppercase tracking-wide text-soft">
                {s.label}
                <span className="rounded-full bg-[#1a2a3d] px-2 py-0.5 text-[11px] text-white">{cards.length}</span>
              </h3>
              <div className="flex min-h-24 flex-col gap-2 p-2">
                {cards.map((l) => (
                  <article
                    key={l.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                    className={`cursor-grab rounded-xl border bg-[#0f1a28] p-3 text-sm active:cursor-grabbing ${l.isNew ? "border-warn" : "border-line"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/leads/${l.id}`} className="font-semibold text-accent hover:underline">
                        {l.name}
                      </Link>
                      {l.isNew && <span className="shrink-0 rounded-full bg-[#3d3022] px-2 py-0.5 text-[10px] font-bold text-warn">LIGAR</span>}
                    </div>
                    {l.phone && (
                      <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} className="mt-1 block font-mono text-xs text-white hover:underline">
                        📞 {l.phone}
                      </a>
                    )}
                    <div className="mt-1 text-[11px] text-soft">
                      {age(l.createdAt, now)}
                      {l.source ? ` · ${l.source}` : ""}
                    </div>
                    <label className="mt-2 block text-[11px] text-soft">
                      <span className="sr-only">Etapa de {l.name}</span>
                      <select
                        value={l.status}
                        onChange={(e) => move(l.id, e.target.value)}
                        className="w-full rounded-md border border-line bg-surface px-2 py-1 text-xs text-white"
                      >
                        {stages.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
