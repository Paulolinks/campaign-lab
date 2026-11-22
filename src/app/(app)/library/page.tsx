import { db } from "@/lib/db";
import { UPLOAD_STATUS } from "@/lib/labels";
import { requireBrand } from "@/lib/session";
import { Empty, PageHeader, Panel } from "../../ui";
import { MediaGrid } from "../media-grid";
import { MediaUploader } from "../media-uploader";

export default async function LibraryPage() {
  const { brand } = await requireBrand();
  const assets = await db().mediaAsset.findMany({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
    include: { variant: { select: { id: true, adKey: true } } },
  });
  const totalMb = assets.reduce((s, a) => s + Number(a.bytes), 0) / 1048576;

  return (
    <>
      <PageHeader
        eyebrow={brand.name}
        title="Biblioteca de criativos"
        subtitle={`${assets.length} arquivo(s) · ${totalMb.toFixed(1)} MB no servidor. Para ligar um arquivo a um anúncio, envie pela página do anúncio.`}
      />
      <Panel title="Enviar arquivos soltos (sem anúncio)" aside="Google Drive: não conectado — arquivos ficam no servidor por enquanto" className="mb-4">
        <MediaUploader brandId={brand.id} />
      </Panel>
      {assets.length === 0 ? (
        <Empty>Nenhum vídeo ou imagem nesta marca ainda.</Empty>
      ) : (
        <MediaGrid
          items={assets.map((a) => ({
            id: a.id,
            kind: a.kind,
            fileName: a.fileName,
            bytes: Number(a.bytes),
            uploadStatusLabel: UPLOAD_STATUS[a.uploadStatus].label,
            variant: a.variant,
          }))}
        />
      )}
    </>
  );
}
