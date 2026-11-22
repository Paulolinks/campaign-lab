# Progress Tracker

> **Carregado em toda sessão — mantenha curto.** É a memória de trabalho do projeto.
> Atualizado pela IA no `/session-end`. Log com mais de 5 sessões → mover as antigas para `context/archive/AAAA-MM.md`.

## Estado atual
- **Fase:** M3 — MVP no ar em https://ads.coolseasonllc.com (VPS, desde 2026-11-15). Atualizar: `sh scripts/deploy.sh`
- **Foco agora:** seguir o roteiro do GUIA-agente-marketing.md: CSV do Ads Manager → spec 03 (criar anúncios pelo Claude Code nas pastas). Spec 02 (Resultados) no ar desde 2026-11-21
- **Spec ativa:** `context/feature-specs/05-agent-read-access.md` (acesso só leitura do Claude; falta deploy e guardar a chave no ambiente do Claude). Spec 04 (Meta só leitura) mergeada no PR #1; token já conectado em Integrações (conta Paulo 2023); falta deploy e conferir números. Última concluída: `context/feature-specs/02-ad-results-and-decisions.md` (Done), que também tem o roteiro das specs 03–07
- **Última atualização:** 2026-11-22

## O que funciona (verificado por teste)
Evidência: `npm test` (verify verde) e `npm run test:e2e` (17 testes Playwright no navegador), todos verdes em 2026-11-22.
- Login do dono (primeiro acesso em `/setup`, só uma vez) com Better Auth; limite de tentativas de login.
- Várias marcas isoladas por `brandId`; seletor de marca no topo; persona versionada (carrega `.md`); termos proibidos por marca; contas/canais por marca (ficam "Desconectado").
- Modelo para IA (Importar → passo 1): baixar ou copiar um .txt personalizado com marca, persona, termos proibidos e o formato; aceita a resposta da IA dentro de bloco ```.
- Importação CSCAMP/1: pré-visualização com erros por linha, avisos de termos proibidos, diff (novo/atualizar/sem mudança), reimportação sem duplicar, versões com snapshot, histórico de importações com SHA-256. Aceita várias campanhas por arquivo.
- Campanhas e anúncios: hipótese, persona, plataformas, objetivo, status, rótulo de teste, histórico. Landing page editável → gera links com UTM.
- Mídia: upload em streaming com checagem do tipo real do arquivo, vídeo com Range (avançar/voltar), arquivos privados (só logado). Storage por interface: `LOCAL` ativo, `GOOGLE_DRIVE` preparado (não conectado).
- Anúncios publicados: vínculo manual pelo ID da plataforma (ex.: ID do anúncio Meta), revínculo auditado, métricas diárias manuais (mesmo dia substitui, não soma).
- Leads: origem/certeza/campanha/anúncio/UTM, aviso de duplicado por telefone/e-mail, etapas com histórico, orçamentos, contrato com custos diretos e margem.
- **Resultados por anúncio (spec 02):** tela `/results` (Em teste / Vivos / Encerrados, "O que fazer hoje", placar por ângulo) e `/published/[id]` (estratégia, período, 5 números principais + "Números da Meta" + "Dinheiro", veredito com o porquê, diagnóstico "o que aconteceu", decisão com aprendizado e linha do tempo). Metas e regras na marca (US$ 20/anúncio/dia, custo por visita, teto/dia). O app só sugere: não pausa nada na Meta.
- **Meta só leitura (spec 04, branch do PR #1, ainda não no ar):** Integrações → Sincronizar agora / Recarregar todo o histórico + painel da última execução; agendador (leads 5 min, números 3 h); Gerenciador "Na Meta" (campanhas/conjuntos/anúncios com as colunas da Meta por período, sugestão de vínculo pelo código da variante) e "Planejado no app"; leads dos formulários entram sozinhos (sem duplicar); Leads com visão Pipeline (arrastar ou menu no celular) e Lista; respostas do formulário no detalhe do lead.
- **Acesso do Claude (spec 05):** Integrações → criar/revogar chave só leitura; API `/api/agent/v1/brands` e `/brands/{id}/export` (sem PII de lead); sync guarda o texto dos anúncios.
- Dashboard: gasto, leads, qualificados, orçamentos, contratos, contribuição após mídia, CPL, CPQL, CAC, fechamento, margem, ROAS, CPM, CTR; funil; comparativo por ângulo; qualidade dos dados. Sem dado = `N/D`.

## Próximos passos (em ordem)
1. Dono preenche as metas da Cool Season em Marcas (US$ 120 por visita, US$ 40 por dia).
2. Importar CSV exportado do Ads Manager (upsert por ID do anúncio + dia, sem somar duas vezes).
3. Spec 03: skill do Claude Code `/criar-anuncios` (pasta `campanhas/<marca>/<data>_<slug>/` com campanha.txt CSCAMP/1 + LEIA.md + midia/) e exportar resultados para o Claude analisar. Bloqueio: o dono precisa baixar o playbook (D0–D5, OpenArt, F1–F3, C1–C2) da Biblioteca do claude.ai para `context/reference/brands/cool-season/playbook/`.
3b. Editar conteúdo de uma variante pelo app (gera nova versão) e exportar campanha em TXT (round trip).
4. Google Drive (OAuth `drive.file`, upload resumable, worker pg-boss tira os arquivos da VPS depois de sincronizar).
5. ~~Fase 2: Meta Marketing API somente leitura~~ → spec 04 (PR #1): fazer deploy e conectar.

## Roadmap
| Marco | Conteúdo | Status |
|---|---|---|
| M0 — Fundação | stack, login, multi-marca, design | Done |
| M1 — Catálogo | importador, campanhas/variantes, persona, mídia local | Done |
| M2 — Resultados | publicados + UTMs, CRM, métricas manuais, dashboard | Done (falta CSV do Ads Manager) |
| M3 — Deploy | VPS (Traefik existente), HTTPS Let's Encrypt, backup diário 14 dias | Done |
| Depois | Drive; Meta read-only; WhatsApp/Pixel/GA4/Google Ads | Futuro |

## Bloqueios e perguntas para o humano
- Playbook D0–C2 não está no disco nem em `hvac-sellers-processor` (GitHub); provavelmente na Biblioteca do claude.ai. Bloqueia a spec 03.

## Problemas conhecidos / dívida técnica
| # | Descrição | Impacto | Onde | Plano |
|---|---|---|---|---|
| 1 | Sem `.env` local: o kit bloqueia a IA de criar `.env`; dev usa padrões não secretos de `src/lib/env.ts` | Nenhum em dev; produção exige `.env` | `src/lib/env.ts` | Criar `.env` na VPS no deploy |
| 2 | Edição de variante pela interface ainda não existe (só por reimportação) | Médio | variantes | Próximo passo 2 |
| 3 | Sem papéis de equipe na interface (só o dono); RBAC já existe no banco | Baixo agora | session.ts | Quando houver equipe |
| 4 | `LeadTouchpoint` (multitoque) da spec não implementado; lead tem uma origem principal | Baixo | schema | Fase de atribuição |
| 7 | `npm audit`: 3 falhas altas em `effect` (dependência do Prisma CLI); correção pede `--force` (troca de versão do Prisma) | Baixo (só CLI/migrations, não roda no navegador) | `prisma` | Avaliar no próximo upgrade do Prisma |
| 5 | Vitest falha inteiro ("failed to find the current suite") quando roda a partir de `d:\` minúsculo, como a trava de fim de turno faz no Windows | Verify vermelho falso | `scripts/run-unit-tests.mjs` normaliza a letra do drive | Resolvido; levar a correção para o AI Project Starter |

## Log de sessões (mais recente primeiro, máx. 5)
### 2026-11-22 (noite: conexão Meta + spec 05)
- **Feito:** PR #1 mergeado; dono conectou o token (usuário do sistema "Conversions API System User", app CS Confort time, conta act_130648509720231, página 204090258310772). Spec 05: chave de acesso do Claude, API de exportação só leitura, texto dos anúncios no sync.
- **Decidido:** o Claude é o analista e lê o app sozinho (nada de o dono exportar CSV); PII de lead nunca sai pela API.
- **Pendente:** deploy; dono cria a chave em Integrações e guarda no ambiente do Claude; primeira análise do histórico.
### 2026-11-22 (spec 04: Meta só leitura + leads + pipeline)
- **Feito:** spec 04 + ADR-0003; sincronização da Meta (campanhas, conjuntos, anúncios, números por dia com histórico de 37 meses, totais por período, leads dos formulários), botão Sincronizar e agendador (leads 5 min, números 3 h), Gerenciador "Na Meta" com as colunas da Meta, Pipeline de leads, badge de leads novos, dívida #6 resolvida (Dashboard uma linha por anúncio/dia). Testes: unit + 16 e2e verdes.
- **Decidido:** dono quer ver as mesmas métricas da Meta, histórico completo, leads chegando sozinhos e pipeline; detalhes técnicos ficam com a IA (sem jargão nas perguntas).
- **Pendente:** merge do PR #1, deploy, dono conectar o token em Integrações e conferir 2–3 números contra o Gerenciador da Meta.
### 2026-11-21 (agente de marketing → spec 02)
- **Feito:** GUIA-agente-marketing.md adaptado ao Campaign Lab (TypeScript, sem Python); spec 02 escrita, aprovada e implementada: ciclo do anúncio (teste até o dia 3 → vivo monitorado → encerrado), diagnóstico, decisões com aprendizado, telas Resultados e detalhe do anúncio.
- **Decidido:** criar anúncios pelo Claude Code nas pastas (sem API do Claude no app); US$ 20/anúncio/dia; passa no teste com 1 visita ou 2 leads; atenção com 1× e parar com 1,5× o custo por visita (US$ 120) sem visita nova; 2 anúncios ao mesmo tempo (US$ 40/dia).
- **Também:** Next.js 16.4.3 → 16.4.6 (correções de segurança); deploy feito, migração aplicada em produção.
- **Pendente:** metas da marca; CSV do Ads Manager; spec 03 (depende do playbook).
### 2026-11-15 (deploy)
- **Feito:** deploy em `/opt/campaign-lab` atrás do Traefik (rede `root_default`, resolver `mytlschallenge`); backup diário; HTTPS validado; outros apps intactos; `scripts/deploy.sh`.
- **Decidido:** domínio ads.coolseasonllc.com; dono autorizou a IA a gerar a configuração do servidor (senhas geradas lá, não exibidas).
### 2026-11-14 (implementação)
- **Feito:** app inteiro do MVP (ver "O que funciona"); 40 testes unitários + 12 e2e; verify do kit ligado a unit + tipos + lint.
- **Decidido:** app se chama "Campaign Lab" (provisório, neutro), plataforma independente; Cool Season é só uma marca; regras de marca (ex.: financiamento) viram dados da marca (termos proibidos), não código; sem dados DEMO.
- **Pendente:** CSV do Ads Manager, edição de variante, deploy.
### 2026-11-14 (setup)
- **Feito:** kit instalado; material em `context/reference/`; overview, arquitetura, ADR-0002.
- **Decidido:** app independente; várias marcas; VPS; stack igual à do publisher, banco separado; mídia local primeiro.
