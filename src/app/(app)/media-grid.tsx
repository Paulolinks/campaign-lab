"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type MediaItem = {
  id: string;
  kind: "IMAGE" | "VIDEO" | "DOCUMENT";
  fileName: string;
  bytes: number;
  uploadStatusLabel: string;
  variant?: { id: string; adKey: string } | null;
};

export function MediaGrid({ items, canDelete = true }: { items: MediaItem[]; canDelete?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(id: string, name: string) {
    if (!confirm(`Apagar "${name}"? Isso não pode ser desfeito.`)) return;
    setBusy(id);
    const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) alert("Não foi possível apagar.");
    router.refresh();
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((m) => (
        <li key={m.id} className="overflow-hidden rounded-xl border border-line bg-surface2">
          <div className="grid aspect-video place-items-center bg-black">
            {m.kind === "VIDEO" && <video src={`/api/media/${m.id}`} controls preload="metadata" className="h-full w-full object-contain" />}
            {m.kind === "IMAGE" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/media/${m.id}`} alt={m.fileName} className="h-full w-full object-contain" />
            )}
            {m.kind === "DOCUMENT" && (
              <a href={`/api/media/${m.id}`} target="_blank" rel="noreferrer" className="text-accent underline">
                Abrir PDF
              </a>
            )}
          </div>
          <div className="p-3 text-xs">
            <div className="truncate font-semibold" title={m.fileName}>
              {m.fileName}
            </div>
            <div className="mt-1 flex flex-wrap justify-between gap-2 text-soft">
              <span>
                {formatBytes(m.bytes)} · {m.uploadStatusLabel}
              </span>
              {m.variant && (
                <Link href={`/variants/${m.variant.id}`} className="break-all text-accent hover:underline">
                  {m.variant.adKey}
                </Link>
              )}
            </div>
            {canDelete && (
              <button onClick={() => remove(m.id, m.fileName)} disabled={busy === m.id} className="mt-2 cursor-pointer text-danger hover:underline disabled:opacity-50">
                {busy === m.id ? "Apagando…" : "Apagar"}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
