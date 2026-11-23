import type { ReactNode } from "react";
import type { SetupRow } from "@/domain/meta-setup";

/** One level of the Meta Ads Manager (campaign, ad set or ad) with its fields, as the owner would fill them in. */
export function MetaLevel({ step, title, subtitle, rows, indent = 0, children }: { step: string; title: string; subtitle?: ReactNode; rows: SetupRow[]; indent?: 0 | 1 | 2; children?: ReactNode }) {
  const margin = ["", "sm:ml-4", "sm:ml-8"][indent];
  return (
    <div className={`overflow-hidden rounded-xl border border-line ${margin}`}>
      <div className="flex flex-wrap items-center gap-2 bg-[#1a2f45] px-4 py-2.5">
        <span className="rounded-md bg-[#4b8ef0] px-2 py-0.5 text-[11px] font-bold text-white">{step}</span>
        <span className="break-all font-mono text-[13px]">{title}</span>
        {subtitle && <span className="text-xs text-[#c9d4e3]">{subtitle}</span>}
      </div>
      {rows.length > 0 && (
        <dl className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div key={r.key} className="bg-[#0f1a28] px-4 py-2.5">
              <dt className="text-[11px] text-soft">{r.label}</dt>
              <dd className="whitespace-pre-wrap break-words font-semibold">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </div>
  );
}
