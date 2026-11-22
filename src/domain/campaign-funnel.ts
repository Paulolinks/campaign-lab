/**
 * Funnel of one campaign, from the idea to the signed contract, and the next thing the owner should do.
 * Pure: receives counts already loaded for the campaign.
 */
import { costPer, type Cents } from "./metrics";

export type CampaignFunnelInput = {
  ads: number;
  approved: number;
  published: number;
  spend: Cents;
  leads: number;
  appointments: number;
  won: number;
};

export type FunnelStep = { key: keyof CampaignFunnelInput; label: string; value: number; hint: string };

export function campaignFunnel(input: CampaignFunnelInput) {
  const steps: FunnelStep[] = [
    { key: "ads", label: "Anúncios criados", value: input.ads, hint: "Importados do arquivo .txt" },
    { key: "approved", label: "Aprovados por você", value: input.approved, hint: "Em Aprovar anúncios" },
    { key: "published", label: "No ar na Meta", value: input.published, hint: "Com o ID do anúncio vinculado" },
    { key: "leads", label: "Leads", value: input.leads, hint: "Pessoas que preencheram" },
    { key: "appointments", label: "Visitas marcadas", value: input.appointments, hint: "A métrica principal" },
    { key: "won", label: "Vendas", value: input.won, hint: "Contratos fechados" },
  ];
  return {
    steps,
    costPerLead: costPer(input.spend, input.leads),
    costPerAppointment: costPer(input.spend, input.appointments),
    next: nextAction(input),
  };
}

export function nextAction(f: CampaignFunnelInput): { step: FunnelStep["key"] | null; text: string } {
  if (f.ads === 0) return { step: "ads", text: "Importe os anúncios desta campanha (Importar TXT)." };
  if (f.approved === 0) return { step: "approved", text: "Aprove pelo menos 1 anúncio em Aprovar anúncios." };
  if (f.published === 0)
    return { step: "published", text: "Crie o anúncio aprovado na Meta (pausado), ligue quando quiser e cole o ID do anúncio em Publicações reais." };
  if (f.leads === 0) return { step: "leads", text: "Esperando os primeiros leads. Lance o gasto de cada dia no anúncio publicado." };
  if (f.appointments === 0) return { step: "appointments", text: "Ligue para os leads e marque a visita. Atualize o status do lead no app." };
  if (f.won === 0) return { step: "won", text: "Faça as visitas e apresente as opções. Registre o orçamento e o contrato no lead." };
  return { step: null, text: "Funil completo. Veja em Resultados se vale continuar ou trocar o anúncio." };
}
