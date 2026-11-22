import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { requireBrand } from "@/lib/session";
import { PageHeader, Panel, Table } from "../../ui";
import { ImportClient } from "./import-client";

export default async function ImportPage() {
  const { brand } = await requireBrand();
  const batches = await db().importBatch.findMany({ where: { brandId: brand.id }, orderBy: { createdAt: "desc" }, take: 10 });

  return (
    <>
      <PageHeader
        eyebrow="Importar"
        title="Importar campanhas (TXT)"
        subtitle="Campanha, anúncios, headlines, textos, roteiros e canais são organizados automaticamente. Reimportar o mesmo arquivo não duplica nada."
      />
      <ImportClient brandName={brand.name} />
      <Panel title="Importações anteriores" className="mt-4">
        {batches.length === 0 ? (
          <p className="text-sm text-soft">Nenhuma importação nesta marca ainda.</p>
        ) : (
          <Table head={["Arquivo", "Quando", "Novos", "Atualizados", "Sem mudança", "SHA-256"]}>
            {batches.map((b) => {
              const s = b.summary as { create?: number; update?: number; unchanged?: number };
              return (
                <tr key={b.id}>
                  <td className="break-all">{b.fileName}</td>
                  <td>{formatDate(b.createdAt, brand.timezone)}</td>
                  <td>{s.create ?? 0}</td>
                  <td>{s.update ?? 0}</td>
                  <td>{s.unchanged ?? 0}</td>
                  <td className="font-mono text-[10px] text-soft">{b.sha256.slice(0, 12)}…</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>
    </>
  );
}
