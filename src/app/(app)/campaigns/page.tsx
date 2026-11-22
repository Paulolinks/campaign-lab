import Link from "next/link";
import { db } from "@/lib/db";
import { PLAN_STATUS } from "@/lib/labels";
import { requireBrand } from "@/lib/session";
import { Empty, LinkButton, PageHeader, Panel, Pill, Table } from "../../ui";

export default async function CampaignsPage() {
  const { brand } = await requireBrand();
  const campaigns = await db().campaignPlan.findMany({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { variants: true, leads: true } } },
  });

  return (
    <>
      <PageHeader
        eyebrow={brand.name}
        title="Campanhas"
        subtitle="Ideias e hipóteses internas. Uma campanha aqui não é a campanha da Meta: o vínculo é feito pelos anúncios publicados."
        actions={<LinkButton href="/import" variant="primary">Importar TXT</LinkButton>}
      />
      <Panel>
        {campaigns.length === 0 ? (
          <Empty action={<LinkButton href="/import" variant="primary">Importar a primeira campanha</LinkButton>}>Nenhuma campanha nesta marca.</Empty>
        ) : (
          <Table head={["Campanha", "Serviço", "Objetivo", "Persona", "Canais", "Anúncios", "Leads", "Status"]}>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/campaigns/${c.id}`} className="font-semibold text-accent hover:underline">
                    {c.name}
                  </Link>
                  <div className="break-all font-mono text-[10px] text-soft">{c.campaignKey}</div>
                </td>
                <td>{c.service}</td>
                <td>{c.objective}</td>
                <td>{c.persona}</td>
                <td>{c.channels.join(", ")}</td>
                <td>{c._count.variants}</td>
                <td>{c._count.leads}</td>
                <td>
                  <Pill tone={PLAN_STATUS[c.status].tone}>{PLAN_STATUS[c.status].label}</Pill>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}
