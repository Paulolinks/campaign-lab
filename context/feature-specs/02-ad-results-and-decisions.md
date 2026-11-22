# Spec 02 — Histórico de anúncios e análise (continuar / pausar / escalar / criar outro)

| Campo | Valor |
|---|---|
| Status | Done |
| Nível | L2 (migração só aditiva: 1 tabela nova + colunas novas; nada é apagado ou renomeado) |
| Autor | IA (Claude) + Paulo |
| Criada em | 2026-11-21 |
| Aprovada em | 2026-11-21 (Paulo, "sim" às recomendações) |
| Relacionadas | `GUIA-agente-marketing.md` (fonte da ideia), spec 01, ADR-0002 |

---

## 0. De onde vem esta spec (guia → Campaign Lab)

O `GUIA-agente-marketing.md` descreve um agente em Python, num projeto separado. O dono decidiu (2026-11-21)
construir dentro do Campaign Lab, em TypeScript, aproveitando o que já existe. Cada fase do guia vira uma spec:

| Fase do guia | O que já existe no app | Spec |
|---|---|---|
| — Histórico + análise ("rodou, estratégia X, tanto tempo, deu X; continua ou não?") | campanhas (hipótese), variantes (ângulo), anúncios publicados, métricas diárias, leads até contrato | **02 (esta)** |
| 1. Criar anúncios com o Claude + checagem das regras D0 | "Modelo para IA" (copiar/colar numa IA externa) + import CSCAMP/1 + termos proibidos | 03 (futura) — **pelo Claude Code nas pastas, não pela API** (ver abaixo) |
| 3. Monitorar (ler números da Meta todo dia 7h) | métricas manuais; CSV do Ads Manager é o próximo passo do tracker | 04 (futura) = Meta read-only (MVP 2) |
| Avisos e aprovação pelo Telegram | — | 05 (futura) |
| 4. Lead chega pelo webhook → assistente do vendedor | CRM manual | 06 (futura) |
| 2. Publicar na Meta (sempre PAUSED + aprovação), pausar sozinho, `/parar` | vínculo manual por ID | 07 (futura) — **muda um não-objetivo; exige ADR** |
| 5. Railway | já roda na VPS com HTTPS | não se aplica |

**Como os anúncios vão ser criados (dono, 2026-11-21):** o dono usa o Claude (Claude Code) mexendo em pastas para
criar as propagandas, e às vezes sobe um TXT com ideias tiradas do ChatGPT. Por isso a spec 03 **não** chama a API
do Claude de dentro do app (sem custo de API). Ela será:
- uma skill do Claude Code (ex.: `/criar-anuncios`) que lê persona, termos proibidos, playbook e o **histórico de
  resultados desta spec**, e gera uma pasta `campanhas/<marca>/AAAA-MM-DD_<slug>/` com `campanha.txt` (CSCAMP/1,
  com estratégia: hipótese, ângulo, variável testada), `LEIA.md` (explicação em português) e `midia/`;
- checagem das regras D0 + termos proibidos antes de importar;
- o `campanha.txt` (do Claude ou do ChatGPT) entra pelo import que já existe. Envio direto do Claude para o app
  (token de API) fica como opção na spec 03;
- exportar os resultados do app (arquivo) para o Claude ler, analisar e propor a próxima rodada.

Ordem proposta: 02 → CSV do Ads Manager (já planejado) → 03 → 04 → 05 → 06 → 07.
A 02 vem primeiro porque responde à pergunta principal do dono **sem custo de API** e porque as fases seguintes
(monitor, Telegram, pausa automática) reaproveitam a mesma regra de decisão.

## 1. Contexto e problema
O dono roda anúncios e hoje não tem um lugar que diga, por anúncio: qual era a estratégia, quanto tempo rodou,
o que deu (gasto, leads, **visitas marcadas**, custo por visita, contratos) e **o que fazer agora e por quê**.
A métrica principal (guia) é **custo por visita marcada**. O dashboard atual soma tudo e compara por ângulo,
mas não julga cada anúncio nem guarda as decisões e os aprendizados.

## 2. Histórias de usuário e critérios de aceite

Definições usadas abaixo:
- **Visita marcada** = lead cujo status atual ou histórico passou por `APPOINTMENT_SCHEDULED` ou etapa posterior (mesma regra do dashboard). [ver esclarecimento 3]
- **Ciclo de vida do anúncio (dono, 2026-11-21):** cada anúncio roda com **US$ 20/dia**. Tem duas fases:
  1. **Teste (dias 1–3):** se até o dia 3 não deu resultado → **cancela**, fecha e o app mostra **o que aconteceu** (onde travou), para a próxima ser melhor.
  2. **Vivo (dia 4 em diante, sem prazo final):** se deu resultado, **continua** e passa a ser **monitorado** todo dia: continua enquanto compensar, para quando deixar de compensar.
- **Dia do anúncio** = contado a partir do primeiro dia com gasto > 0 (dia 1), por calendário no fuso da marca.
- **Gasto desde a última visita** = gasto acumulado depois da data da última visita marcada (ou desde o dia 1, se nunca marcou). É o principal sinal de "parou de compensar".
- **Últimos 7 dias** = janela usada no monitoramento dos anúncios vivos; o total do anúncio aparece ao lado.
- Leads de um anúncio = leads com `publishedAdId` desse anúncio. Lead ainda em `NEW`/`CONTACTED` conta como **"em andamento"** (pode virar visita depois).

### US-1: Como dono, quero definir as metas e limites de cada marca para que a análise use os meus números
- **AC-1.1** — Dado a tela da marca, quando informo "orçamento por anúncio/dia" (padrão US$ 20), "custo máximo por visita marcada" e "gasto máximo por dia da marca", então os valores são salvos em USD (Decimal) só para essa marca.
- **AC-1.2** — Dado uma marca sem custo máximo por visita, quando abro a análise, então ela mostra "Defina o custo máximo por visita na marca"; as regras que dependem da meta ficam `Sem meta` e as outras funcionam.
- **AC-1.3** — Dado os parâmetros (dia da decisão do teste = 3, leads mínimos para passar no teste = 2, atenção quando gasto desde a última visita ≥ 1× a meta, parar quando ≥ 1,5× a meta, frequência máxima = 3, tolerância de gasto diário = 25 %, e os limites do diagnóstico), quando não altero nada, então valem esses padrões, e posso editar cada um.

### US-2: Como dono, quero ver o histórico de cada anúncio publicado com a estratégia e o resultado
- **AC-2.1** — Dado um anúncio publicado, quando abro a página dele, então vejo: **estratégia** (campanha + hipótese, ângulo, gancho, variável testada, persona), **período** (primeiro e último dia com dados, dias rodando, ou data de encerramento) e **resultado** (últimos 7 dias e total), organizado sem confusão (pedido do dono: "só o que é importante"):
  - **Linha principal (sempre visível, 5 números grandes):** Gasto · Leads · Visitas marcadas · **Custo por visita marcada** · Contratos (com receita).
  - **"Números da Meta" (mesmos nomes do Gerenciador de Anúncios, recolhido por padrão):** Impressões · Alcance · Frequência · CTR (link) · CPC (link) · CPM · Custo por lead.
  - **"Dinheiro" (só aparece se houver orçamento ou contrato):** Orçamentos enviados · Receita · Margem · ROAS.
  - Nada além disso nesta tela. Cada número tem uma dica curta ("o que é isso") em português.
- **AC-2.2** — Dado a lista "Resultados", quando abro, então vejo os anúncios da marca ativa em 3 grupos: **Em teste**, **Vivos**, **Encerrados**; cada linha mostra só: veredito, dia, gasto, leads, visitas, custo por visita.
- **AC-2.3** — Dado uma métrica sem denominador (ex.: 0 visitas), quando é exibida, então aparece `N/D`, nunca 0.

### US-3: Como dono, quero que o app me diga se continuo ou paro cada anúncio, e por quê
**Fase de teste (dias 1–3):**

| Situação | Veredito |
|---|---|
| sem gasto ainda | **AGUARDANDO INÍCIO** |
| dia 1–2 | **EM TESTE — decidir no dia 3** (o dono pode cancelar antes; o app mostra o diagnóstico parcial) |
| dia ≥ 3, sem decisão, com ≥ 1 visita marcada **ou** ≥ 2 leads | **PASSOU NO TESTE → deixar vivo** |
| dia ≥ 3, sem decisão, com menos que isso | **NÃO DEU RESULTADO → cancelar** (+ diagnóstico) |

**Fase viva (depois que o dono registra "Manter vivo"):** a primeira que bater decide:
1. **PARAR** — gasto desde a última visita ≥ 1,5 × custo máximo por visita (ex.: US$ 180 sem nenhuma visita nova, com meta de US$ 120).
2. **ATENÇÃO** — gasto desde a última visita ≥ 1 × a meta, **ou** custo por visita dos últimos 7 dias > meta.
3. **CONTINUAR — está compensando** — nenhuma acima.
Alerta extra para vivos: **criativo cansando** quando a frequência dos últimos 7 dias > 3 → "preparar um criativo novo para este ângulo".

**Diagnóstico "o que aconteceu"** (no cancelamento, no PARAR e no teste parcial): mostra a primeira etapa do funil que travou, com os números. São **pistas**, não certezas:

| Onde travou | Sinal (padrões editáveis) | Pista mostrada |
|---|---|---|
| Entrega | menos de 1.000 impressões | "A Meta quase não mostrou: público pequeno, orçamento ou anúncio em análise" |
| Atenção | CTR (link) < 1 % | "As pessoas viram e não clicaram: o gancho/criativo não chamou atenção" |
| Conversão | ≥ 15 cliques no link e 0 leads | "Clicaram e não deixaram contato: formulário, oferta ou página" |
| Qualidade/atendimento | ≥ 2 leads e 0 visitas | "Chegou lead e não virou visita: lead fraco ou atendimento/ligação" |
| Sem dados de mídia | sem impressões registradas | "Registre as métricas para ver o diagnóstico" |

**Alertas (qualquer fase):** gasto de algum dia > orçamento por anúncio/dia + 25 %; soma do orçamento/dia dos anúncios ativos > gasto máximo por dia da marca.

- **AC-3.1** — Dado um anúncio, quando abro a análise, então vejo a fase, o dia ("Dia 3"), o veredito e uma frase de "por quê" com os números (ex.: "Dia 3: gastou US$ 60, 2.300 impressões, CTR 0,4 %, nenhum lead").
- **AC-3.2** — Dado cada linha das tabelas de teste, vivo, diagnóstico e alertas, quando os dados de teste batem exatamente no limite, então o resultado é o documentado (testes de fronteira: = conta como bater).
- **AC-3.3** — Dado a marca ativa, quando abro "Resultados", então vejo no topo: **"Decidir hoje"** (testes no dia 3+ sem decisão), **"Parar"** e **"Atenção"** (vivos), alertas, e o placar por ângulo (quantos passaram no teste / foram cancelados, e o custo por visita dos vivos), com uma frase "O que fazer hoje" montada a partir disso (sem IA nesta spec).
- **AC-3.4** — O veredito é só **sugestão**: o app não pausa nem altera nada na Meta (não há integração ainda); a tela diz "faça no Gerenciador de Anúncios e registre aqui".

### US-4: Como dono, quero registrar a decisão e o aprendizado para que fique salvo o que funcionou e o que não
- **AC-4.1** — Dado um anúncio, quando clico "Registrar decisão" e escolho **Manter vivo** / **Cancelar** / **Parar**, com uma nota opcional ("aprendizado"), então a decisão fica salva com data, quem decidiu, o veredito sugerido naquele momento, o diagnóstico e uma cópia dos números (snapshot), e aparece na linha do tempo do anúncio.
- **AC-4.2** — Dado uma decisão "Cancelar" ou "Parar", quando salva, então o anúncio vai para "Encerrados" com data de fim e a duração é contada até ela. Dado "Manter vivo", o anúncio vai para "Vivos".
- **AC-4.3** — Dado decisões antigas, quando as métricas mudam depois, então o snapshot salvo não muda (mostra o que eu sabia quando decidi).
- **AC-4.4** — Toda decisão grava no `AuditLog`.

### Casos de borda e erros
- Anúncio sem métrica nenhuma → "Sem dados ainda", veredito AGUARDANDO INÍCIO.
- Anúncio sem variante vinculada → estratégia mostra "Sem variante vinculada" e um link para vincular.
- Leads só com `variantId` (sem `publishedAdId`) → não entram no anúncio; aparecem num aviso "N leads desta variante sem anúncio definido" (qualidade dos dados).
- Frequência: com alcance diário somado, a frequência é **aproximada** (média das frequências diárias com alcance informado); sem alcance → `N/D`. Frequência só gera alerta nos anúncios vivos.
- Usuário de outra marca/workspace → 404 (mesma autorização das outras rotas).

## 3. Fora de escopo
- Pausar, ligar ou mudar orçamento na Meta (spec 07).
- Puxar números da Meta automaticamente (spec 04) e importar CSV (próximo passo do tracker).
- Relatório escrito por IA e Telegram (specs 03/05).
- Regras por campanha ou por anúncio (os parâmetros são por marca).

## 4. Esclarecimentos
| # | Pergunta | Resposta | Data |
|---|---|---|---|
| 1a | Orçamento e ciclo de cada anúncio | US$ 20/dia; teste até o dia 3: sem resultado cancela e vê o que aconteceu; com resultado fica vivo sem prazo e é monitorado (continua enquanto compensar) | 2026-11-21 |
| 1b | Custo máximo por visita marcada (define "compensa" nos vivos)? | US$ 120 (valor inicial da Cool Season, editável) | 2026-11-21 |
| 1c | Quantos anúncios rodando ao mesmo tempo (define o teto da marca)? Plano de marketing fala em US$ 250/semana ≈ 1–2 anúncios de US$ 20 | 2 anúncios → gasto máximo por dia US$ 40 | 2026-11-21 |
| 2 | Passa no teste do dia 3 com ≥ 1 visita marcada **ou** ≥ 2 leads; vivo para com US$ 180 gastos sem visita nova (1,5× a meta) e fica em atenção com US$ 120. Recomendado: sim (editável) | Sim | 2026-11-21 |
| 3 | "Visita marcada" = lead que chegou em `APPOINTMENT_SCHEDULED` ou depois (inclui visita feita, orçamento, ganho). Recomendado: sim | Sim | 2026-11-21 |
| 4 | Janela das regras | Teste: dias 1–3 inteiros; vivos: gasto desde a última visita + últimos 7 dias | 2026-11-21 |
| 5 | Onde estão os arquivos do playbook (D0–D5, OpenArt, F1–F3, C1–C2)? | Não estão em `D:\HVAC Sellers Processor` nem no disco (busca por nome em D:, Documentos, Downloads, Desktop). Provável: "Biblioteca" do projeto no claude.ai. Dono copia para `context/reference/brands/cool-season/playbook/`. **Não bloqueia a 02**; bloqueia a 03 | 2026-11-21 |
| 6 | Como os anúncios serão criados? | Claude Code mexendo em pastas + TXT ocasional do ChatGPT; app mostra métricas tipo Facebook, só as importantes (AC-2.1) | 2026-11-21 |

---

## 5. Design técnico
### Arquivos afetados
| Arquivo | Ação | O quê |
|---|---|---|
| `prisma/schema.prisma` + nova migration | alterar | `Brand`: `adDailyBudget Decimal?` (padrão 20), `targetCostPerAppointment Decimal?`, `maxDailySpend Decimal?`, `decisionRules Json?`; `PublishedAd`: `lifecycle` (TESTING/LIVE/ENDED, padrão TESTING), `endedAt DateTime?`; novo model `AdDecision` |
| `src/domain/ad-decision.ts` (+ `.test.ts`) | criar | regra pura: `evaluateAd(input, brand, rules, today) → { day, phase, verdict, reasons[], diagnosis, alerts[] }` e `defaultRules` (Zod) |
| `src/domain/ad-results.ts` (+ `.test.ts`) | criar | agrega métricas por anúncio (total, últimos 7 dias, desde a última visita) reaproveitando `metrics.ts`/`scorecard` |
| `src/app/(app)/results/page.tsx` | criar | lista em 3 grupos + "Decidir hoje" / "Parar" / "Atenção" / alertas / placar por ângulo |
| `src/app/(app)/published/[id]/page.tsx` | criar | histórico do anúncio: estratégia, período, resultado, veredito, linha do tempo |
| `src/app/(app)/published/actions.ts` | alterar | ação `recordDecision` (Zod, auth por marca, AuditLog) |
| `src/app/(app)/brands/brand-fields.tsx`, `brands/actions.ts` | alterar | campos de meta, teto e parâmetros |
| `src/app/(app)/nav.tsx` | alterar | item "Resultados" |
| `tests/*.spec.ts` (e2e) | criar | fluxo: define meta → métricas → veredito → registra decisão |

### Contratos
```ts
type Phase = "TESTING" | "LIVE" | "ENDED";
type Verdict = "NOT_STARTED" | "TESTING_DECIDE_DAY_3" | "TEST_PASSED_KEEP" | "TEST_FAILED_CANCEL"
             | "LIVE_CONTINUE" | "LIVE_ATTENTION" | "LIVE_STOP" | "ENDED" | "NO_TARGET";
type Stage = "DELIVERY" | "ATTENTION" | "CONVERSION" | "LEAD_QUALITY" | "NO_MEDIA_DATA";
type Alert = "OVERSPEND_DAY" | "BRAND_CAP_EXCEEDED" | "CREATIVE_FATIGUE";
type DecisionRules = { decisionDay: 3; minLeadsToPass: 2; minAppointmentsToPass: 1;
  attentionSpendMultiple: 1; stopSpendMultiple: 1.5; maxFrequency: 3; dailyOverspendTolerancePct: 25;
  diag: { minImpressions: 1000; minLinkCtr: 0.01; minClicksForConversion: 15; minLeadsForQuality: 2 } };
evaluateAd(
  input: { lifecycle: Phase; firstSpendDate: Date|null; daily: {date: Date; spendCents: number;
      impressions: number; reach: number|null; linkClicks: number|null}[];
    leads: {createdAt: Date; inProgress: boolean; appointmentAt: Date|null}[]; endedAt: Date|null },
  brand: { adDailyBudgetCents: number; targetCostPerAppointmentCents: number|null;
    maxDailySpendCents: number|null; activeAdsCount: number },
  rules: DecisionRules, today: Date  // in the brand timezone
): { day: number|null; phase: Phase; verdict: Verdict; reasons: string[];
     diagnosis: { stage: Stage; hint: string } | null; alerts: Alert[] }
```

### Dados
```prisma
enum DecisionAction { KEEP_LIVE CANCEL STOP }
enum AdLifecycle { TESTING LIVE ENDED }
model AdDecision {
  id             String         @id @default(cuid())
  brandId        String
  publishedAdId  String
  action         DecisionAction
  suggested      String         // verdict at decision time
  reasons        String[]
  snapshot       Json           // metrics + diagnosis at decision time (cents, counts)
  note           String?        // owner's learning
  decidedById    String
  decidedAt      DateTime       @default(now())
  @@index([publishedAdId, decidedAt])
}
```
Migração aditiva, sem backfill. Dinheiro em `Decimal` no banco e centavos inteiros no domínio (padrão de `metrics.ts`).

### Interface
Segue `ui-context.md` e a spec 01 (design system). Veredito como selo colorido + texto (não só cor). Mobile primeiro:
cartões empilhados na lista. Estados: sem dados, sem meta, sem variante, erro ao salvar.

### Alternativas consideradas
| Opção | Prós | Contras | Escolhida? |
|---|---|---|---|
| Veredito calculado na hora (função pura) + decisões salvas | sempre atual, fácil de testar, sem job | recalcula a cada abertura (barato no volume atual) | ✅ |
| Salvar veredito por dia num job | histórico diário automático | precisa do worker (ainda não existe); vem com a spec 04 | |
| Pedir o veredito ao Claude | texto mais rico | custo de API, resultado não determinístico, não testável | (vira complemento na spec 03/05) |

## 6. Riscos
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Lead sem `publishedAdId` some da conta → custo por visita parece pior | Média | Alto | aviso de qualidade dos dados (casos de borda) |
| Métricas manuais atrasadas → veredito errado | Média | Médio | mostrar "última métrica: dia X"; CSV e depois Meta API |
| Frequência aproximada | Alta | Baixo | rótulo "aprox."; vira exata com a Meta API |
| No dia 3 os leads ainda não viraram visita (vendedor não ligou) | Alta | Médio | teste aceita ≥ 2 leads; "gasto desde a última visita" só conta depois que o anúncio fica vivo |
| Limites do diagnóstico (CTR 1 %, 1.000 impressões, 15 cliques) são chutes iniciais | Alta | Baixo | rotulados como "pista" e editáveis; recalibrar com os primeiros testes |
| Métrica do dia não registrada → gasto do teste parece menor | Média | Médio | dia do teste é por calendário; mostra "dias sem métrica: N" |

## 7. Plano de testes
| Critério | Tipo de teste | Como verificar |
|---|---|---|
| AC-1.1–1.3 | unitário (Zod/defaults) + e2e | salvar marca e reabrir |
| AC-2.1–2.3 | unitário (`ad-results`) + e2e | números conferidos à mão num caso fixo |
| AC-3.1–3.2 | unitário (`ad-decision`) | 1 teste por regra + fronteiras + ordem de prioridade |
| AC-3.3 | unitário + e2e | resumo com 3 anúncios em vereditos diferentes |
| AC-4.1–4.4 | integração/e2e | registrar decisão, mudar métrica, snapshot igual; AuditLog criado |

---

## 8. Tarefas
- [x] T1 — Migration aditiva (Brand, PublishedAd.endedAt, AdDecision) (AC-1.1, AC-4.1)
- [x] T2 — `ad-decision.ts` + testes: fase de teste, fase viva, diagnóstico, alertas e fronteiras (AC-3.1, AC-3.2)
- [x] T3 — `ad-results.ts` + testes (total, 7 dias, desde a última visita, frequência aprox.) (AC-2.1, AC-2.3)
- [x] T4 — Campos de meta/teto/parâmetros na marca (AC-1.1–1.3)
- [x] T5 — Página do anúncio: estratégia, período, resultado, veredito (AC-2.1, AC-3.1, AC-3.4)
- [x] T6 — Registrar decisão + linha do tempo + AuditLog + Encerrar (AC-4.1–4.4)
- [x] T7 — Lista "Resultados" (Em teste / Vivos / Encerrados) + "O que fazer hoje" + item no menu (AC-2.2, AC-3.3)
- [x] T8 — e2e do fluxo completo; `node scripts/verify.mjs` verde
- [x] T9 — Atualizar progress-tracker e architecture-context

## 9. Aprovação
- [x] **Aprovado pelo humano** — Paulo, 2026-11-21

## 10. Notas de implementação
- 
