# PROMPT PARA COLAR NO CLAUDE DENTRO DO VS CODE

> **Atenção (2026-11-14):** a instrução abaixo de integrar com o Social Video Creator foi substituída. O app é independente. Veja `context/reference/README.md`.

Você é um engenheiro de software full-stack sênior responsável por implementar um app real, seguro e utilizável chamado **CS Campaign Lab**. Leia PRIMEIRO os arquivos anexos, nesta ordem:
1. `01_ESPECIFICACAO_PARA_CLAUDE.md`
2. `Guia_Persona_Cool_Season_para_IA.md` (documento estratégico vinculante)
3. `02_EXEMPLO_CAMPANHA_IMPORTAVEL.txt`
4. `04_PARSER_REFERENCIA.ts` (exemplo do contrato de importação)
5. `05_PROTOTIPO_VISUAL.html` (referência de UI, apenas dados fictícios)
6. `Persona_Mestra_Cool_Season_HVAC_2026.pdf` (referência complementar)

**Regra de execução:** Antes de gerar arquivos, inspecione a estrutura do repositório existente e informe em 8–12 linhas como irá se integrar sem quebrar o código do Social Video Creator. Não copie autenticação, banco ou dependências cegamente; reutilize o que for seguro e pertinente, isole dados/serviços quando necessário. O aplicativo deve ser acessível no VPS por HTTPS.

Construa em etapas pequenas e testáveis. **Na primeira etapa, implemente completamente o MVP 1**, incluindo login, marca Cool Season, persona, importador TXT, catálogo de campanhas e anúncios, upload Drive ou fallback privado, CRUD leads/propostas/contratos, UTMs, importação CSV Meta, dados de exemplo claramente identificados como DEMO, dashboard com métricas reais/cadastradas, análises e relatório. Use Next.js + TypeScript + PostgreSQL + Prisma + Docker Compose, a menos que a stack local sugira escolha claramente melhor. Faça migrations, testes, validação, roles, empty/error/loading states, proteção dos arquivos e manual de deploy.

**Não finja que integrações Meta/WhatsApp/Google estão ativas.** Na primeira etapa, deixe conectores por interface com estado DESCONECTADO/EM CONFIGURAÇÃO. Configure o modelo de dados para permitir fase 2: Meta Ads read-only, sync de ads por ID, Insights, Lead Ads; fase 3: Pixel/CAPI/GA4/WhatsApp Business Platform e Google Ads. Marketplace será apenas canal manual condicionado às políticas; nunca automatizar listagens/DM/scraping.

Implementar o importador CSCAMP/1 com validação de campos, campos multilinha, feedback por linha, reimportação idempotente e versionamento de anúncios. `AdVariant` é diferente de `PublishedAd`: o mesmo arquivo pode gerar múltiplos anúncios nas plataformas, cada qual com ID remoto e métricas independentes. O usuário associa o criativo ao anúncio publicado e pode editar o vínculo depois; manter audit log.

Marketing: todo texto cliente-facing em inglês americano, com marca Cool Season, persona The Careful Homeowner, sem financiamento, claims inventados, depoimentos fictícios ou ofertas não aprovadas. O software deve mostrar margem, custo por lead qualificado, contratos e ROI — não só likes.

Me apresente uma sequência de entregas e execute código, migrations, testes e README. Ao concluir cada etapa, indique o que realmente funciona, quais credenciais reais faltam e que testes foram realizados; não declarar sucesso para integrações ainda não conectadas.
