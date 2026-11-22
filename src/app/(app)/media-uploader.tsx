"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Uploads one or more files with progress. Files go straight to /api/media as a stream. */
export function MediaUploader({ brandId, variantId }: { brandId: string; variantId?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    for (const [i, file] of files.entries()) {
      try {
        await upload(file, (pct) => setStatus(`Enviando ${i + 1}/${files.length}: ${file.name} — ${pct}%`));
      } catch (err) {
        setError(`${file.name}: ${err instanceof Error ? err.message : "falha no envio"}`);
      }
    }
    setStatus(null);
    setBusy(false);
    router.refresh();
  }

  function upload(file: File, onProgress: (pct: number) => void) {
    const params = new URLSearchParams({ brandId });
    if (variantId) params.set("variantId", variantId);
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/media?${params}`);
      xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
      xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          try {
            reject(new Error(JSON.parse(xhr.responseText).error));
          } catch {
            reject(new Error(`erro ${xhr.status}`));
          }
        }
      };
      xhr.onerror = () => reject(new Error("conexão falhou"));
      xhr.send(file);
    });
  }

  return (
    <div>
      <label className={`grid cursor-pointer place-items-center rounded-xl border-2 border-dashed border-[#3b5b6b] p-5 text-center hover:border-accent ${busy ? "opacity-60" : ""}`}>
        <span className="text-2xl text-accent">↥</span>
        <span className="font-semibold">Adicionar vídeo ou imagem</span>
        <span className="text-[11px] text-soft">MP4, MOV, WEBM, JPG, PNG, WEBP, GIF ou PDF</span>
        <input type="file" multiple accept="video/*,image/*,application/pdf" onChange={onChange} disabled={busy} className="mt-2 max-w-xs" aria-label="Arquivos de mídia" />
      </label>
      {status && <p className="mt-2 text-xs text-soft">{status}</p>}
      {error && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
