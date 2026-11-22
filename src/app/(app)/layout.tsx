import { getBrandContext, requireUser } from "@/lib/session";
import { signOut } from "../actions";
import { Logo } from "../ui";
import { BrandSwitcher } from "./brand-switcher";
import { Nav } from "./nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { brands, brand } = await getBrandContext(user);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[245px_minmax(0,1fr)]">
      <aside className="flex items-center gap-3 overflow-x-auto border-b border-line bg-sidebar px-3 py-2 md:sticky md:top-0 md:block md:h-screen md:border-b-0 md:border-r md:px-4 md:py-6">
        <div className="hidden md:mx-1.5 md:mb-7 md:block">
          <Logo />
        </div>
        <div className="mx-3 mb-2 hidden text-[10px] font-extrabold tracking-[1.3px] text-[#758ba7] md:block">WORKSPACE</div>
        <Nav />
        <div className="mx-1.5 mt-7 hidden border-t border-line pt-4 text-[11px] text-[#91a3ba] md:block">
          <div className="truncate">{user.name}</div>
          <div className="truncate">{user.email}</div>
          <form action={signOut} className="mt-2">
            <button className="cursor-pointer text-accent hover:underline">Sair</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-end gap-3 border-b border-line px-4 py-3 md:px-10">
          <span className="mr-auto text-xs text-soft">
            {brand ? (
              <>
                Marca ativa: <strong className="text-ink">{brand.name}</strong> · {brand.currency} · {brand.timezone}
              </>
            ) : (
              "Nenhuma marca cadastrada"
            )}
          </span>
          <BrandSwitcher brands={brands} currentId={brand?.id ?? null} />
          <form action={signOut} className="md:hidden">
            <button className="cursor-pointer text-xs text-accent">Sair</button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-[1630px] px-4 py-7 md:px-10">{children}</main>
      </div>
    </div>
  );
}
