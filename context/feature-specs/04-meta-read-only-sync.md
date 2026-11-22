# Spec 04 — Meta somente leitura: Gerenciador com as métricas da Meta + leads dos formulários num pipeline

| Campo | Valor |
|---|---|
| Status | Draft (esclarecimentos respondidos; aguardando aprovação) |
| Nível | L3 (tabelas novas + um serviço novo no Docker Compose que agenda a sincronização; ver ADR-0003) |
| Autor | IA (Claude) + Paulo |
| Criada em | 2026-11-22 |
| Aprovada em | — |
| Relacionadas | spec 02 (Resultados), `campanhas/CONECTAR-FACEBOOK.md` (etapa 1 "Só leitura"), ADR-0002, ADR-0003 (proposta), dívida técnica #6 |

---

## 1. Contexto e problema
Hoje o app só confere se o token da Meta funciona (Integrações → "Salvar e testar conexão"). Todo número de anúncio
(gasto, impressões, cliques, leads) é digitado à mão em Publicados ou viria de um CSV. O Gerenciador mostra só o que
foi **planejado** no app (campanha → variante), não o que está de fato rodando na Meta.

Esta spec liga a primeira etapa do `CONECTAR-FACEBOOK.md`: com as credenciais que já ficam salvas em Integrações
(token criptografado, conta de anúncios, App Secret opcional), o app **lê** da Meta as campanhas, os conjuntos, os
anúncios e as métricas de cada anúncio por dia, inclusive o histórico, e mostra isso no Gerenciador. A tela Resultados
(spec 02) e o Dashboard passam a usar esses números sem digitação.

Na mesma spec (pedido do dono em 2026-11-22), os leads dos formulários da Meta passam a chegar sozinhos no app, e a
tela de Leads ganha um **pipeline** (colunas por etapa, como a Central de Leads da Meta) para mover e trabalhar cada lead.

**Somente leitura:** as permissões usadas são `ads_read` (números) e `leads_retrieval` (leads). O app não cria, liga, pausa nem muda orçamento na Meta.

## 2. Histórias de usuário e critérios de aceite

### US-1: Como dono, quero que o app puxe da Meta tudo o que existe na minha conta de anúncios
- **AC-1.1** — Dado que a marca tem a conexão Meta salva e testada, quando eu clico **"Sincronizar agora"** (Integrações
  ou Gerenciador), então o app busca todas as campanhas, conjuntos e anúncios da conta (inclusive pausados e
  arquivados) e grava nome, status, objetivo, orçamento e datas de cada um.
- **AC-1.2** — Dado a primeira sincronização de uma marca, quando ela termina, então as métricas diárias de cada anúncio
  estão salvas desde o primeiro dia com gasto até ontem, limitado ao que a Meta guarda (cerca de 37 meses).
- **AC-1.3** — Dado uma sincronização em andamento, quando eu clico de novo, então o app avisa "já está sincronizando"
  e não começa outra.
- **AC-1.4** — Dado uma sincronização qualquer, quando ela termina, então Integrações mostra quando foi, quanto tempo
  levou, quantas campanhas/conjuntos/anúncios/dias foram lidos, ou o erro com a etapa em que parou.
- **AC-1.5** — Dado que um anúncio já foi ligado à mão (Publicados, pelo ID do anúncio), quando a sincronização roda,
  então ele **não é duplicado**: o mesmo registro recebe nome, status e métricas, e o vínculo com a variante continua.

### US-2: Como dono, quero que os números se atualizem sozinhos
- **AC-2.1** — Dado a conexão ativa, então o app sincroniza sozinho a cada 3 horas (estrutura + métricas dos últimos 7
  dias, incluindo hoje).
- **AC-2.2** — Dado que a Meta corrige os números dos últimos dias (atribuição atrasada), quando a sincronização relê esse
  período, então o valor salvo é **substituído**, nunca somado.
- **AC-2.3** — Dado que o token foi apagado, expirou ou perdeu `ads_read`, quando a sincronização automática roda, então
  ela para sem apagar nada, marca a conexão como "Erro" em Integrações com a mensagem da Meta e tenta de novo só no
  próximo horário.

### US-3: Como dono, quero ver no Gerenciador o que está rodando na Meta
- **AC-3.1** — Dado a marca conectada, quando abro o Gerenciador, então vejo a visão **"Na Meta"** com as abas Campanhas,
  Conjuntos e Anúncios, com os nomes, status e orçamentos reais da Meta.
- **AC-3.2** — Dado a visão "Na Meta", quando escolho um período (Hoje, Ontem, 7 dias, 30 dias, Este mês, Máximo), então
  cada linha mostra as mesmas colunas do Gerenciador da Meta: resultados (leads da Meta), custo por resultado, valor
  usado, alcance, impressões, frequência, CPM, cliques no link, CPC e CTR. Campanha e conjunto somam os anúncios deles.
- **AC-3.3** — Dado um anúncio da Meta, então a linha mostra se ele está ligado a uma variante do app (com link) ou um
  botão **"Ligar à variante"** que abre o vínculo que já existe em Publicados.
- **AC-3.4** — O interruptor Lig./Desl. mostra o status real da Meta (`effective_status`) e continua só de leitura, com a
  dica "Ligar e desligar ainda é feito no Gerenciador da Meta".
- **AC-3.5** — O rodapé do Gerenciador mostra "Dados da Meta de <data e hora>" (última sincronização bem-sucedida, no
  fuso da marca) e os números marcados como vindos da Meta.
- **AC-3.6** — A visão **"Planejado no app"** (a tela de hoje, com prévia e aprovação) continua igual e acessível.

### US-4: Como dono, quero que Resultados e Dashboard usem esses números sem contar nada duas vezes
- **AC-4.1** — Dado um dia de um anúncio com números de mais de uma fonte (Manual, CSV, Meta), então Resultados **e
  Dashboard** usam uma linha só por dia, na prioridade Meta > CSV > Manual (resolve a dívida técnica #6).
- **AC-4.2** — Dado anúncios puxados da Meta que **não** estão ligados a uma variante, então eles entram no gasto total do
  Dashboard, mas não aparecem em Resultados até serem ligados. Quando o nome do anúncio na Meta tem o código de uma
  variante (ex.: "A01"), o Gerenciador sugere o vínculo e o dono confirma com um clique.
- **AC-4.3** — Lançar métrica manual continua possível; quando a Meta tem o mesmo dia, a tela mostra o número da Meta.

### US-5: Como dono, quero que o lead do formulário da Meta chegue sozinho no app
- **AC-5.1** — Dado um formulário instantâneo da Meta ligado à página da marca, quando alguém preenche, então em até
  5 minutos o lead aparece em Leads na etapa "Novo", com nome, telefone, e-mail, as respostas do formulário, o anúncio,
  o conjunto e a campanha de onde veio (origem "Meta Lead Ads", certeza "Confirmada").
- **AC-5.2** — Dado um lead que já existe no app (mesmo ID da Meta, ou mesmo telefone/e-mail), quando ele chega de novo,
  então não é duplicado; o aviso de duplicado que já existe continua valendo.
- **AC-5.3** — Na primeira sincronização, o app traz os leads antigos que a Meta ainda guarda (cerca de 90 dias).
- **AC-5.4** — Lead novo vindo da Meta fica destacado em Leads e no menu com a contagem de "novos sem contato".

### US-6: Como dono, quero um pipeline para trabalhar os leads
- **AC-6.1** — Dado a tela Leads, quando escolho a visão **Pipeline**, então vejo uma coluna por etapa (Novo, Contatado,
  Qualificado, Visita marcada, Visita feita, Orçamento enviado, Ganho, Perdido) com um cartão por lead.
- **AC-6.2** — Quando arrasto um cartão para outra coluna (ou uso o menu do cartão no celular), então a etapa muda e
  fica no histórico do lead, igual à mudança de etapa que já existe hoje.
- **AC-6.3** — O cartão mostra nome, telefone (toque para ligar), há quanto tempo entrou e o anúncio de origem; abrir o
  cartão leva ao detalhe do lead que já existe (notas, orçamentos, contrato).
- **AC-6.4** — A visão em lista de hoje continua disponível.

### Casos de borda e erros
- **Sem conexão salva:** Gerenciador mostra só "Planejado no app" e um aviso com link para Integrações.
- **Limite de chamadas da Meta (erro de rate limit, códigos 4, 17, 32, 613, 80000–80014):** a sincronização para, guarda o
  que já leu, mostra "A Meta pediu para esperar; tentaremos de novo às HH:MM" e retoma no próximo horário.
- **Conta com muitos anúncios:** todas as listas da Meta são paginadas até o fim; o histórico é pedido em blocos de no
  máximo 30 dias para não estourar o tempo de resposta.
- **Moeda e fuso:** valores ficam na moeda da conta de anúncios; os dias seguem o fuso da conta da Meta. Se a moeda ou o
  fuso da conta forem diferentes dos da marca, Integrações mostra um aviso.
- **Anúncio apagado na Meta:** não some do app; fica com status "Excluído" e o histórico é mantido.
- **Outra marca/workspace:** tudo continua isolado por `brandId`; uma marca nunca lê a conexão de outra.
- **Segredos:** o token nunca é gravado em log, em `AuditLog`, em erro mostrado na tela ou enviado ao navegador.

## 3. Fora de escopo
- Criar, ligar, pausar ou mudar orçamento na Meta (spec 07; continua não-objetivo).
- Receber lead por webhook (instantâneo); aqui o app confere a cada 5 minutos.
- Responder ou mandar mensagem ao lead pela Meta, WhatsApp ou e-mail.
- Criativos completos (vídeo/imagem do anúncio); só o nome e, se a Meta devolver, a miniatura.
- Quebras por idade, gênero, posicionamento ou região.
- Instagram/Facebook orgânico, Google Ads.
- Avisos por Telegram (spec 05).

## 4. Esclarecimentos
| # | Pergunta | Resposta | Data |
|---|---|---|---|
| 1 | Como o Gerenciador mostra os dados da Meta? | Visão "Na Meta" com as mesmas métricas do Gerenciador da Meta; a tela atual continua como "Planejado no app" | 2026-11-22 |
| 2 | Atualizar sozinho? | Sim, sozinho + botão "Sincronizar agora". Números a cada 3 h; leads a cada 5 min | 2026-11-22 |
| 3 | Quanto histórico? | Tudo que a Meta guardar, para análise e planejamento das próximas propagandas | 2026-11-22 |
| 4 | Anúncios antigos sem variante no app | Dono não precisa decidir: ficam no Gerenciador e no gasto total; em Resultados só os ligados; o app sugere o vínculo pelo código no nome | 2026-11-22 |
| 5 | O que é "Resultado"? | Leads da Meta | 2026-11-22 |
| 6 | Leads | Dono pediu (2026-11-22): leads dos formulários chegam sozinhos + pipeline por etapas, "que nem tem lá" | 2026-11-22 |
| 7 | Como agendar a atualização automática | Detalhe técnico decidido pela IA: agendador simples no Docker (ADR-0003), sem instalar programa novo | 2026-11-22 |

---

## 5. Design técnico

### Arquivos afetados
| Arquivo | Ação | O quê |
|---|---|---|
| `prisma/schema.prisma` + nova migration | alterar | `MetaCampaign`, `MetaAdSet`, `MetaSyncRun` (novos); colunas novas em `PublishedAd` (ver Dados). Só aditiva |
| `src/domain/meta-sync.ts` (+ `.test.ts`) | criar | Funções puras: converter respostas da Graph API em linhas do banco (orçamento em centavos, status, ações → leads), dividir o período em blocos de 30 dias, decidir o período de cada sincronização, classificar erros (rate limit, token, permissão) |
| `src/lib/meta.ts` | alterar | `graphGet` ganha paginação (`paging.next`) e parâmetros extras; nada muda no teste de conexão |
| `src/lib/meta-sync-service.ts` | criar | Roda uma sincronização de uma marca: trava por marca, lê estrutura e insights, grava em transações, registra `MetaSyncRun` e `AuditLog` (sem token) |
| `src/app/api/internal/meta-sync/route.ts` | criar | Rota interna chamada pelo agendador; exige `SYNC_SECRET` no cabeçalho e só aceita da rede interna do Docker |
| `src/app/(app)/integrations/actions.ts` / `page.tsx` | alterar | Botão "Sincronizar agora", painel da última sincronização, aviso de moeda/fuso |
| `src/app/(app)/manager/page.tsx` (+ componentes novos `manager/meta-view.tsx`, `manager/period-picker.tsx`) | alterar/criar | Seletor "Na Meta" / "Planejado no app", período, colunas de métricas |
| `src/domain/dashboard.ts` / `src/app/(app)/page.tsx` | alterar | Aplicar `pickOneRowPerDay` por anúncio (AC-4.1) |
| `src/lib/ad-results-service.ts` | alterar | Filtrar anúncios sem variante (AC-4.2) |
| `src/lib/meta-leads-service.ts` + `src/domain/meta-leads.ts` (+ testes) | criar | Ler os formulários da página e os leads novos; converter respostas em `Lead` (dedupe por ID da Meta, telefone, e-mail) |
| `src/app/(app)/leads/page.tsx` + `leads/pipeline.tsx` | alterar/criar | Visão Pipeline (colunas por etapa, arrastar e menu no celular) reaproveitando a ação de mudar etapa |
| `compose.traefik.yaml`, `scripts/vps-setup-env.sh` | alterar | Serviço `scheduler` (mesmo padrão do `backup`) e a variável `SYNC_SECRET` |
| `context/decisions/0003-meta-sync-scheduler.md` | criar | ADR do agendador sem pg-boss |
| `context/architecture-context.md`, `context/progress-tracker.md` | alterar | Registrar a decisão e o estado |

### Contratos
```
// src/lib/meta-sync-service.ts
type SyncMode = "INCREMENTAL" | "FULL";          // FULL = estrutura + todo o histórico (1ª vez e "Recarregar tudo")
type SyncTrigger = "MANUAL" | "SCHEDULED";
runMetaSync(brandId: string, opts: { mode: SyncMode; trigger: SyncTrigger; userId?: string }):
  Promise<{ ok: true; runId: string; counts: { campaigns: number; adSets: number; ads: number; days: number } }
        | { ok: false; runId: string | null; step: string; message: string; retryAfter?: Date }>

// POST /api/internal/meta-sync  (header x-sync-secret: <SYNC_SECRET>)
// Roda INCREMENTAL para cada marca com MetaConnection; FULL para a marca que ainda não tem run com sucesso.
// 200 { brands: [{ brandId, ok, step?, message? }] } · 401 sem segredo
```

Chamadas à Meta (Graph API, versão em `META_GRAPH_VERSION`, padrão atual `v23.0`), todas `GET`:
- `act_<id>/campaigns` — `id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time`
- `act_<id>/adsets` — `id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,start_time,end_time,targeting`
- `act_<id>/ads` — `id,name,adset_id,campaign_id,status,effective_status,created_time,creative{thumbnail_url}`
- `act_<id>/insights` — `level=ad`, `time_increment=1`, `time_range={since,until}`, campos `ad_id,date_start,spend,impressions,reach,frequency,clicks,inline_link_clicks,actions`
- `<page_id>/leadgen_forms` e `<form_id>/leads` (filtro por data de criação) — `id,created_time,ad_id,adset_id,campaign_id,form_id,field_data`
- Para incluir arquivados e excluídos nas listas, usar o filtro de `effective_status` correspondente. **Os nomes exatos
  dos campos e filtros serão conferidos na documentação oficial da Marketing API na hora de implementar** (AGENTS.md §3.2).

### Dados (migração só aditiva)
- `MetaCampaign`: `brandId`, `externalId` (único por marca), `name`, `objective`, `status`, `effectiveStatus`,
  `dailyBudget`/`lifetimeBudget` (`Decimal`, moeda da conta), `startTime`, `stopTime`, `externalCreatedAt`, `lastSyncAt`.
- `MetaAdSet`: igual + `campaignExternalId`, `optimizationGoal`, `targetingSummary` (texto curto: região e idade).
- `PublishedAd` (já existe): colunas novas `effectiveStatus`, `thumbnailUrl`, `externalCreatedAt`. A sincronização faz
  upsert por `(brandId, platform=META, externalAdId)`, que já é único, então um anúncio ligado à mão é reaproveitado
  (AC-1.5). Anúncio novo vindo da Meta entra com `variantId = null`.
- `DailyAdInsight` (já existe): upsert por `(publishedAdId, date, source=META_API)` → substitui, não soma (AC-2.2).
  `platformLeads` = soma das ações de lead; `actions` guarda a lista original para auditoria.
- `Lead` (já existe): coluna nova `externalLeadId` (único por marca) e `formAnswers` (JSON com as respostas do formulário).
- `MetaSyncRun`: `brandId`, `mode`, `trigger`, `status` (RUNNING/SUCCESS/ERROR), `startedAt`, `finishedAt`, contagens,
  `step`, `error` (texto sem token), `retryAfter`. Uma `RUNNING` com menos de 30 min bloqueia outra da mesma marca (AC-1.3).

### Interface
- **Integrações:** abaixo do teste de conexão, um painel "Sincronização" com o botão "Sincronizar agora", o link
  "Recarregar todo o histórico", a última execução (quando, duração, contagens ou erro) e o próximo horário automático.
- **Gerenciador:** no topo, seletor `Na Meta | Planejado no app` e o seletor de período. A visão "Na Meta" usa as mesmas
  abas e a mesma tabela visual de hoje (cores de veiculação já existentes), com as colunas de US-3. Estado vazio: "Ainda
  não sincronizou. Clique em Sincronizar agora." Estado de erro: faixa vermelha com a mensagem da última execução.
- Seguir `context/ui-context.md` e o design system da spec 01.

### Alternativas consideradas
| Opção | Prós | Contras | Escolhida? |
|---|---|---|---|
| Agendador simples no Compose (contêiner que chama a rota interna a cada 3 h, como o `backup`) | Sem dependência nova; mesmo padrão que já roda no servidor | Sincronização roda dentro do processo web; trava feita no banco | ✅ (ADR-0003) |
| Worker com pg-boss (o que o `architecture-context.md` previa) | Fila com retry/backoff, processo separado | Dependência nova e um segundo processo Node para manter; exagero para 1 conta | Depois, quando houver Drive + várias marcas |
| Só botão manual | Mais simples | Resultados fica velho se o dono esquecer | Se Q2 = (c) |
| Usar o SDK oficial `facebook-nodejs-business-sdk` | Tipos prontos | Dependência grande para 4 chamadas GET; `fetch` já funciona no teste de conexão | |

## 6. Riscos
| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Gasto contado duas vezes (Manual/CSV + Meta) | Alta sem a correção | Alto | AC-4.1 com teste cobrindo Dashboard e Resultados |
| Limite de chamadas da Meta na primeira carga | Média | Baixo | Blocos de 30 dias, pausa ao receber erro de limite, retoma no próximo horário |
| Números dos últimos dias mudam depois (atribuição) | Certa | Médio | Reler sempre os últimos 7 dias |
| Campo ou filtro com nome diferente na versão atual da API | Média | Médio | Conferir na documentação oficial antes de codar; testes com respostas gravadas |
| Vazamento do token em log/erro | Baixa | Alto | Só a mensagem do erro da Meta é guardada; teste que verifica que o token não aparece |
| Moeda/fuso da conta diferente da marca | Baixa | Médio | Aviso em Integrações |

## 7. Plano de testes
| Critério | Tipo de teste | Como verificar |
|---|---|---|
| AC-1.1, 1.5 | integração (banco de teste + respostas da Meta gravadas, sem rede) | Upsert cria campanhas/conjuntos/anúncios; anúncio ligado à mão não duplica e mantém a variante |
| AC-1.2 | unitário | Divisão do histórico em blocos de 30 dias, limite de ~37 meses |
| AC-1.3 | integração | Segunda chamada com run `RUNNING` é recusada |
| AC-2.2 | integração | Reler o mesmo dia substitui o valor |
| AC-2.3, bordas de limite | unitário | Classificação dos códigos de erro da Meta; nada é apagado |
| AC-3.x | e2e (Playwright) | Com dados sincronizados de teste: seletor de visão, período, totais por campanha = soma dos anúncios |
| AC-4.1 | unitário + integração | Dashboard e Resultados com Manual + CSV + Meta no mesmo dia mostram só o da Meta |
| AC-5.1, 5.2 | unitário + integração | Respostas gravadas de `<form_id>/leads` viram `Lead` com origem e anúncio certos; reimportar não duplica |
| AC-6.x | e2e (Playwright) | Mover um cartão de coluna muda a etapa e grava o histórico |
| Segredos | unitário | Erro e auditoria não contêm o token |
| Real | manual | Dono clica "Sincronizar agora" em produção e confere 2 ou 3 números contra o Gerenciador da Meta |

---

## 8. Tarefas
- [ ] T1 — ADR-0003 aceito; conferir campos e filtros na documentação oficial da Marketing API
- [ ] T2 — Migration aditiva (`MetaCampaign`, `MetaAdSet`, `MetaSyncRun`, colunas em `PublishedAd`)
- [ ] T3 — `src/domain/meta-sync.ts` + testes (conversões, blocos de datas, erros)
- [ ] T4 — Paginação em `src/lib/meta.ts`
- [ ] T5 — `meta-sync-service.ts` (estrutura, insights, trava, registro) + testes de integração (AC-1.x, 2.x)
- [ ] T6 — Botão e painel de sincronização em Integrações
- [ ] T7 — Rota interna + serviço `scheduler` no Compose + `SYNC_SECRET`
- [ ] T8 — Dashboard e Resultados com uma linha por dia; Resultados sem anúncios não ligados (AC-4.x)
- [ ] T9 — Gerenciador: visão "Na Meta", período, colunas, vínculo (AC-3.x) + e2e
- [ ] T9b — Leads da Meta a cada 5 min + leads antigos na 1ª vez (AC-5.x) + testes
- [ ] T9c — Pipeline em Leads (AC-6.x) + e2e
- [ ] T10 — Deploy, sincronização real com o dono, atualizar `architecture-context.md` e `progress-tracker.md`

## 9. Aprovação
- [ ] **Aprovado pelo humano** — 

## 10. Notas de implementação
- 
