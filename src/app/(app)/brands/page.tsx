import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ActionForm } from "../../action-form";
import { Button, Empty, PageHeader, Panel, Pill } from "../../ui";
import { createBrand } from "./actions";
import { BrandFields } from "./brand-fields";

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser();
  const { new: showNew } = await searchParams;
  const brands = await db().brand.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { campaigns: true, variants: true, leads: true, channels: true } } },
  });

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Marcas" subtitle="Cada marca tem a própria persona, canais, campanhas, criativos, leads e métricas. Os dados não se misturam." />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Suas marcas">
          {brands.length === 0 ? (
            <Empty>Nenhuma marca ainda. Crie a primeira ao lado.</Empty>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {brands.map((b) => (
                <li key={b.id}>
                  <Link href={`/brands/${b.id}`} className="block rounded-xl border border-line bg-surface2 p-4 hover:border-accent">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate">{b.name}</strong>
                      {b.archivedAt && <Pill>Arquivada</Pill>}
                    </div>
                    <div className="mt-1 text-xs text-soft">{b.industry ?? "Sem segmento"}</div>
                    <div className="mt-3 flex flex-wrap gap-x-3 text-[11px] text-soft">
                      <span>{b._count.campaigns} campanhas</span>
                      <span>{b._count.variants} anúncios</span>
                      <span>{b._count.leads} leads</span>
                      <span>{b._count.channels} canais</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Nova marca" aside={showNew ? "Comece por aqui" : undefined}>
          <ActionForm action={createBrand}>
            <BrandFields />
            <Button type="submit" variant="primary">
              Criar marca
            </Button>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
