import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const APP_NAME = "Campaign Lab";

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: ReactNode; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="text-[11px] font-extrabold uppercase tracking-[1.5px] text-accent">{eyebrow}</div>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight break-words md:text-[28px]">{title}</h1>
        {subtitle && <div className="mt-1 text-soft">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, aside, children, className = "" }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[13px] border border-line bg-surface p-5 ${className}`}>
      {(title || aside) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-[15px] font-bold">{title}</h2>}
          {aside && <div className="text-[11px] text-soft">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-[11px] font-semibold text-soft">{label}</div>
      <div className={`mt-1.5 truncate text-2xl font-bold tracking-tight ${value === "N/D" ? "text-soft" : ""}`}>{value}</div>
      {hint && <div className="mt-1 text-[10px] text-success">{hint}</div>}
    </div>
  );
}

const pillTones = {
  neutral: "border-[#47536a] text-[#d1d7e6]",
  demo: "border-[#755432] bg-[#3b2d19] text-[#ffd89c]",
  ok: "border-[#2f5f58] bg-[#203c3a] text-success",
  warn: "border-[#5d4a2c] bg-[#3d3022] text-warn",
  danger: "border-[#6b2f2f] bg-[#3a1d1d] text-danger",
} as const;

export type PillTone = keyof typeof pillTones;

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: PillTone }) {
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold ${pillTones[tone]}`}>{children}</span>;
}

const buttonStyles = {
  default: "border-line bg-surface hover:border-accent",
  primary: "border-accent bg-accent text-accent-ink hover:brightness-110",
  danger: "border-[#6b2f2f] bg-[#3a1d1d] text-danger hover:border-danger",
} as const;

export function Button({ variant = "default", className = "", ...props }: ComponentProps<"button"> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      className={`cursor-pointer rounded-[9px] border px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  );
}

export function LinkButton({ variant = "default", className = "", ...props }: ComponentProps<typeof Link> & { variant?: "default" | "primary" }) {
  return <Link className={`inline-block rounded-[9px] border px-3 py-2 font-semibold ${buttonStyles[variant]} ${className}`} {...props} />;
}

export function Field({ label, hint, ...props }: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-soft">{label}</span>
      <input {...props} />
      {hint && <span className="text-[11px] text-soft">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, hint, ...props }: ComponentProps<"textarea"> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-soft">{label}</span>
      <textarea rows={4} {...props} />
      {hint && <span className="text-[11px] text-soft">{hint}</span>}
    </label>
  );
}

export function Select({ label, options, ...props }: ComponentProps<"select"> & { label: string; options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-soft">{label}</span>
      <select aria-label={label} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-dashed border-[#3a5065] p-6 text-center text-[#a6b7c9]">
      <div>{children}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border-b border-line px-2.5 py-3 text-left text-[11px] font-semibold text-soft">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-line [&_td]:px-2.5 [&_td]:py-3 [&_td]:align-top">{children}</tbody>
      </table>
    </div>
  );
}

/** Label/value block for read-only content. Text is rendered as text (never HTML). */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wide text-soft">{label}</div>
      <div className="mt-1 whitespace-pre-wrap break-words">{children || <span className="text-soft">—</span>}</div>
    </div>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-3 text-[17px] font-bold tracking-tight">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-[#236765] to-accent font-black text-[#082421]">CL</div>
      <span className="whitespace-nowrap">{APP_NAME}</span>
    </div>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-7">
        <Logo />
        <h1 className="mt-6 text-xl font-bold">{title}</h1>
        <p className="mb-5 mt-1 text-sm text-soft">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
