"use client";

import { useState } from "react";

/** Copies a text (e.g. an image prompt) to the clipboard. */
export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const copy = () =>
    navigator.clipboard?.writeText(text).then(
      () => setState("ok"),
      () => setState("fail"),
    ) ?? setState("fail");
  return (
    <button type="button" onClick={copy} className="min-h-11 rounded-[10px] border border-line bg-[#0f1a28] px-4 text-sm font-semibold hover:border-accent">
      {state === "ok" ? "Copiado ✓" : state === "fail" ? "Selecione e copie à mão" : label}
    </button>
  );
}
