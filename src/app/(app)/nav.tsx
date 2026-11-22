"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/manager", label: "Gerenciador de anúncios", icon: "▤" },
  { href: "/results", label: "Resultados", icon: "◆" },
  { href: "/brands", label: "Marcas", icon: "◎" },
  { href: "/campaigns", label: "Campanhas", icon: "◧" },
  { href: "/import", label: "Importar TXT", icon: "↥" },
  { href: "/library", label: "Criativos", icon: "▶" },
  { href: "/published", label: "Anúncios publicados", icon: "⇄" },
  { href: "/leads", label: "Leads e vendas", icon: "♙" },
  { href: "/integrations", label: "Integrações", icon: "⚙" },
];

/** `newLeads` = leads still in "Novo" (not contacted yet): shown as a badge on Leads. */
export function Nav({ newLeads = 0 }: { newLeads?: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 md:flex-col">
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 whitespace-nowrap rounded-[9px] px-3 py-2 text-xs font-semibold md:py-2.5 md:text-sm ${
              active ? "bg-[#1a3040] text-[#e6fffa] md:border-l-[3px] md:border-accent" : "text-[#b9c9dd] hover:bg-[#1a3040]"
            }`}
          >
            <span className="w-5 text-center text-base">{item.icon}</span>
            {item.label}
            {item.href === "/leads" && newLeads > 0 && (
              <span className="ml-auto rounded-full bg-warn px-1.5 text-[10px] font-bold text-[#1b1407]" title="Leads novos sem contato">
                {newLeads}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
