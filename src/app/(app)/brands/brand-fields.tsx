import { DEFAULT_RULES, parseRules } from "@/domain/ad-decision";
import { Field, TextArea } from "../../ui";

type Money = { toString(): string } | null | undefined;

type BrandValues = {
  name?: string;
  industry?: string | null;
  domain?: string | null;
  serviceArea?: string | null;
  timezone?: string;
  currency?: string;
  forbiddenTerms?: string[];
  notes?: string | null;
  adDailyBudget?: Money;
  targetCostPerAppointment?: Money;
  maxDailySpend?: Money;
  decisionRules?: unknown;
};

const RULE_FIELDS = [
  { name: "decisionDay", label: "Dia da decisão do teste", hint: "No dia 3 o app diz se passou ou cancela." },
  { name: "minLeadsToPass", label: "Leads para passar no teste", hint: "Ou 1 visita marcada." },
  { name: "minAppointmentsToPass", label: "Visitas para passar no teste" },
  { name: "attentionSpendMultiple", label: "Atenção: gasto sem visita nova (× meta)", hint: "1 = o valor de uma visita." },
  { name: "stopSpendMultiple", label: "Parar: gasto sem visita nova (× meta)", hint: "1,5 = US$ 180 com meta de US$ 120." },
  { name: "maxFrequency", label: "Frequência máxima (criativo cansando)" },
  { name: "dailyOverspendTolerancePct", label: "Tolerância de gasto por dia (%)" },
  { name: "diagMinImpressions", label: "Diagnóstico: impressões mínimas" },
  { name: "diagMinLinkCtr", label: "Diagnóstico: CTR mínimo (0.01 = 1%)" },
  { name: "diagMinClicksForConversion", label: "Diagnóstico: cliques sem lead" },
  { name: "diagMinLeadsForQuality", label: "Diagnóstico: leads sem visita" },
] as const;

export function BrandFields({ brand = {} }: { brand?: BrandValues }) {
  const rules = parseRules(brand.decisionRules);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Nome da marca" name="name" defaultValue={brand.name} required placeholder="Ex.: Cool Season" />
      <Field label="Segmento" name="industry" defaultValue={brand.industry ?? ""} placeholder="Ex.: HVAC residencial" />
      <Field label="Site / domínio" name="domain" defaultValue={brand.domain ?? ""} placeholder="https://..." />
      <Field label="Área atendida" name="serviceArea" defaultValue={brand.serviceArea ?? ""} placeholder="Ex.: Marietta / Atlanta, GA" />
      <Field label="Fuso horário" name="timezone" defaultValue={brand.timezone ?? "America/New_York"} />
      <Field label="Moeda" name="currency" defaultValue={brand.currency ?? "USD"} maxLength={3} />
      <div className="md:col-span-2">
        <TextArea
          label="Termos proibidos nos anúncios desta marca"
          name="forbiddenTerms"
          rows={3}
          defaultValue={(brand.forbiddenTerms ?? []).join("\n")}
          hint="Um por linha ou separados por vírgula. A importação avisa quando um anúncio usar algum deles (ex.: financing, 0% APR, guaranteed)."
        />
      </div>
      <fieldset className="grid gap-3 rounded-[11px] border border-line p-4 md:col-span-2 md:grid-cols-3">
        <legend className="px-1 text-xs font-bold">Teste de anúncios: metas e limites</legend>
        <Field label="Orçamento por anúncio/dia" name="adDailyBudget" inputMode="decimal" defaultValue={brand.adDailyBudget?.toString() ?? "20.00"} hint="Cada anúncio roda com este valor por dia." />
        <Field label="Custo máximo por visita marcada" name="targetCostPerAppointment" inputMode="decimal" defaultValue={brand.targetCostPerAppointment?.toString() ?? ""} placeholder="120.00" hint="Define se um anúncio vivo compensa." />
        <Field label="Gasto máximo por dia da marca" name="maxDailySpend" inputMode="decimal" defaultValue={brand.maxDailySpend?.toString() ?? ""} placeholder="40.00" hint="Soma de todos os anúncios rodando." />
        <details className="md:col-span-3">
          <summary className="cursor-pointer text-xs font-semibold text-soft">Regras da análise (avançado)</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {RULE_FIELDS.map((r) => (
              <Field key={r.name} label={r.label} name={`rule_${r.name}`} inputMode="decimal" defaultValue={String(rules[r.name])} placeholder={String(DEFAULT_RULES[r.name])} hint={"hint" in r ? r.hint : undefined} />
            ))}
          </div>
        </details>
      </fieldset>
      <div className="md:col-span-2">
        <TextArea label="Observações" name="notes" rows={2} defaultValue={brand.notes ?? ""} />
      </div>
    </div>
  );
}
