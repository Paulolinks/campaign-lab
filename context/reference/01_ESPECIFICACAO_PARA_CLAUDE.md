# CS CAMPAIGN LAB — ESPECIFICAÇÃO FUNCIONAL E TÉCNICA

**Versão:** 1.0 — 14/11/2026  
**Destino:** Claude no VS Code / Cursor / equipe de desenvolvimento  
**Estado:** projeto de software a construir; as funcionalidades abaixo NÃO representam integrações já ativadas.

## 0. Leitura obrigatória e propósito

Este projeto é um aplicativo web privado, mobile-friendly, hospedado na VPS do proprietário, com URL dedicada e autenticação. Ele organiza marcas, personas, hipóteses de campanhas, cópias de anúncios, roteiros, vídeos/imagens, experimentos, anúncios reais, indicadores e CRM básico para empresas locais de serviço. O caso inicial é **Cool Season / CS Comfort Time**, HVAC residencial na área efetivamente atendida de Marietta/Atlanta, Geórgia.

**Carregar no brand kit o arquivo `Guia_Persona_Cool_Season_para_IA.md` e o PDF** anexados ao kit; respeitar as restrições de claims e o contexto do negócio. A persona principal é **“The Careful Homeowner”**: valoriza transparência, trabalho bem executado, reputação, conforto e suporte; não é uma pessoa que ignora preço. Não há financiamento disponível atualmente. Sem promessas de 0% APR, 100% de resultados, depoimentos fictícios, descontos, licenças ou garantias inventadas.

**Pergunta central do produto:** Qual ângulo/criativo/canal está gerando **clientes qualificados e contratos lucrativos**, não apenas cliques e mensagens?

**Princípio indispensável:** separar sempre métricas da plataforma (atribuídas/modeladas) de fatos comerciais do CRM (leads reais, visitas, propostas, vendas e custos). Não somar conversões de fontes diferentes como se fossem clientes distintos. Não declarar que uma conexão API está ativa quando não estiver.

---

## 1. Escopo e sequência de implementação

### MVP 1 — funciona SEM aprovação da Meta
1. Login protegido (owner/admin; depois vendedor e editor).
2. Marcas/canais. Criar **Cool Season** e vincular persona mestre, documentos, logo e áreas atendidas.
3. Biblioteca de **campanhas planejadas**, **variantes de anúncios** (copy/headline/description/script), **criativos**, **landing pages** e **experimentos**.
4. Importação robusta de **TXT** com pré-visualização, erros localizados, validação, prevenção de duplicatas, preservação de versões e rollback.
5. Upload de mídia (vídeo MP4/imagem) via **Google Drive API** com autorização OAuth; salvar arquivo `driveFileId` e metadados no PostgreSQL, não usar Drive como banco relacional. Fallback: storage local privado e fila de sincronização quando Drive indisponível.
6. URLs de campanha com UTM, código interno estável da variante e tracking de formulários no website.
7. Mini CRM: registrar/enriquecer leads, qualificação, visita, proposta, ganho/perdido, receita e custos diretos.
8. Métricas manuais e **importação de CSV exportado do Ads Manager** (de preferência por ID remoto quando existir, com mapeamento explícito).
9. Dashboard, comparativo de criativos e relatórios exportáveis; explicação visual de origem e qualidade dos dados.
10. Mock visual navegável e seeds SIMULADOS para testes de UI, sem confundir com campanhas reais.

### MVP 2 — integração Meta read-only
1. Configurar app Meta e credenciais OAuth/permissões necessárias conforme o uso e acesso disponível.
2. Conectar conta de anúncios (ad account), identificar páginas/identidades relevantes e armazenar IDs.
3. Sincronizar via Marketing API **campaigns → adsets → ads → creatives** e `effective_status`, com atualização por polling; importar diariamente Insights por nível de anúncio.
4. Associar anúncios externos aos criativos internos por **remote_ad_id** escolhido pelo usuário; sugerir match por ad name ou código, nunca unir automaticamente baseado só em headline.
5. Mostrar “Ativo no Meta”, “Pausado”, “Em revisão”, “Rejeitado” conforme dados reais; sinalizar última sincronização, erro, fuso e período.
6. Opcional: webhooks de Lead Ads (Instant Forms) com permissão `leads_retrieval`, configuração do objeto Page e hidratação segura dos dados de lead.

### MVP 3 — mensageria, otimização e expansão
1. WhatsApp **Business Platform Cloud API**, se o número e a conta tiverem integração elegível. Mensagens do WhatsApp Business app comum não se tornam acessíveis automaticamente. Se coexistência for utilizada, validar elegibilidade, setup e cobertura de eventos antes de prometer sincronização.
2. Meta Pixel + Conversions API (CAPI) com deduplicação para eventos da landing page; Feedback de leads qualificados/vendas via integração apropriada, observando permissão, privacidade e nomenclatura/qualificação de eventos.
3. GA4 Data API para sessões, landing pages e eventos agregados. Não presumir junção 1:1 de visitantes do GA4 com pessoas do CRM.
4. Google Ads API para importação de campanhas e Insights; habilitar projeto no Google Cloud e solicitar nível de acesso aplicável. **Desde 09/09/2026, developer tokens foram descontinuados para novos fluxos**; onboarding agora se orienta pelo Google Cloud Project, apesar de páginas antigas ainda mencionarem tokens.
5. Alertas, relatórios semanais, atribuição multitoque com regras transparentes e otimização com amostras suficientes.
6. Integrações futuras: Google Business Profile, Search/LSA quando APIs permitirem, GA4, call tracking, CRM/service software, outros canais.

**Não construir no MVP:** publicação automática em Marketplace, scraping do Messenger, automação não autorizada de login, publicação de anúncios pagos diretamente pela API, respostas automáticas com IA sem aprovação, conexão WhatsApp pessoal por QR code não oficial, atribuição individual impossível.

---

## 2. Modelo de navegação e UX

**Sidebar:** Dashboard | Marcas | Persona/Brand Kit | Campanhas | Laboratório A/B | Biblioteca de Criativos | Importar TXT | Anúncios Publicados | Leads & Orçamentos | Relatórios | Integrações | Configurações.

### Dashboard da marca
Filtros globais: marca, período (7, 14, 30, 90 dias), serviço (mini-split, central, reparo etc.), canal, campanha, experimento, data de sincronização, fonte do indicador.

Primeira linha de cartões:
- **Gasto em anúncios (USD)**, **Leads válidos únicos**, **Leads qualificados**, **Propostas enviadas**, **Contratos ganhos**, **Margem de contribuição depois da mídia**.
- Segunda linha: CPM, CTR link, CPC link, CPL, CPQL, custo por agendamento, taxa de fechamento, CAC, margem média.
- Funil visual `impressões → cliques no link → landing page views (se disponível) → leads únicos → leads qualificados → visitas → propostas → ganhos`.
- Comparativo por *ângulo*, não apenas por plataforma: `instalação correta`, `garantia/atendimento`, `orçamento transparente`, `preço`, `conveniência`.
- Diagnóstico curto de qualidade de dados: “3 leads sem origem”, “2 anúncios sem vínculo”, “Meta sincronizada há 3 horas”, “GA4 não conectado”.

### Tela da campanha
Cabeçalho: campanha, serviço, persona, objetivo, hipótese, orçamento planejado, responsável, status interno, plataformas, destino/UTM, experimento A/B. Cards de cada **variante** com thumbnail, vídeo, texto, headline, preview e dados reais associados. Abas: Criativos | Publicações | Leads | Funil | Financeiro | Histórico/Versões.

### Tela da variante
- Conteúdo importado: hook, copy principal, headline, description, CTA, vídeo roteiro, prompt de imagem, formato, placement, estágio do funil, hipótese.
- Mídia: upload MP4/JPG/PNG, thumbnail, duração, dimensões, hash, status de Drive.
- Distribuição: múltiplas instâncias publicadas na mesma variante (Facebook Feed, Instagram Reels, Meta Ads, canal manual). Cada instância tem plataforma, conta, external ID, url, data, status.
- Métricas por publicação/período com etiqueta `Meta API`, `CSV`, `Manual`, `GA4` ou `CRM`.
- Comentários internos, revisão, aprovação, tags, histórico de alterações.

### Tela de importação
Arrastar/soltar TXT, validar formato, exibir quantas campanhas/ads serão criados, aviso de duplicados, aviso de promessas proibidas/financeiro, selecionar marca e pasta. Botões `Pré-visualizar`, `Importar como rascunho`, `Cancelar`. **Importação não publica nada**. Registrar hash do arquivo, versão, data, erros por linha e duplicação por `AD_KEY`.

### Tela de integrações
Meta: conta conectada, ID, permissões autorizadas, `ads_read`, data do token/expiração, última sincronização, Erro. Google Drive: pasta, espaço e acesso. Website: domínio, pixel/dataset/GA4, health check e eventos recebidos. WhatsApp: não conectado/Cloud API verificada. Google Ads: futura integração. **Jamais simular conectividade com números fictícios.**

---

## 3. Contrato de importação de anúncios TXT

Usar o formato `CSCAMP/1` descrito no arquivo `02_EXEMPLO_CAMPANHA_IMPORTAVEL.txt` deste kit. Escolhido deliberadamente para funcionar com Claude, ser humano-legível, estável, fácil de parsear e validável. Suportar UTF-8, CRLF/LF e linhas em branco.

**Gramática:**
- Primeira linha significativa `CSCAMP/1`.
- `CAMPAIGN` / `END_CAMPAIGN` delimitam campanha; `AD` / `END_AD` delimitam anúncio.
- Chaves `NOME: valor`; um campo por linha.
- Conteúdo multilinha `NOME: <<<` até uma linha que contenha exatamente `>>>`.
- `AD_KEY` único por marca; reimportar mesmo arquivo não duplica. Usar upsert/versions conforme estratégia aprovada e mostrar diff antes de atualizar.
- Campos obrigatórios campanha: `CAMPAIGN_KEY`, `BRAND`, `PERSONA`, `SERVICE`, `OBJECTIVE`, `TEST_HYPOTHESIS`, `CHANNELS`, `LANDING_URL` (pode ser template).
- Campos obrigatórios AD: `AD_KEY`, `ANGLE`, `FORMAT`, `FUNNEL_STAGE`, `HOOK`, `PRIMARY_TEXT`, `HEADLINE`, `CTA`, `VISUAL_DIRECTION`. `DESCRIPTION`, `VIDEO_SCRIPT`, `IMAGE_PROMPT`, `NOTES`, `CREATIVE_STATUS` opcionais.
- Não tratar campos do TXT como HTML executável. Escapar XSS, limitar tamanho de importação, rejeitar extensões suspeitas, prevenir path traversal.
- Exportar TXT no mesmo contrato (round trip) e JSON normalizado para integração.

**Separar 3 entidades:** `CampaignPlan` (ideia/hipótese), `AdVariant` (copy/criativo), `PublishedAd` (ocorrência na plataforma com ID remoto). Uma variante pode ter vários `PublishedAds`; uma campanha de planejamento pode estar ligada a uma campanha Meta ou a várias por experimento. Não igualar `CAMPAIGN_KEY` interno a `campaign_id` da Meta.

**Naming convention** sugerida: `CS | MS | QUALITY | 2026-11 | A01` (marca | serviço mini split | ângulo | mês | variante); tags são para organização, **IDs externos são a chave de atribuição**.

---

## 4. Fluxos reais de dados e limitações

### Meta Ads
- Dados: `act_{id}/campaigns`, `act_{id}/ads`, objeto Ad com `id, name, campaign_id, adset_id, creative, effective_status, configured_status, updated_time`; Ads Insights em nível `ad` com `date_start,date_stop,impressions,reach,frequency,spend,cpm,cpc,ctr,clicks,inline_link_clicks,outbound_clicks,actions,cost_per_action_type,video_*` somente onde disponíveis na conta/tipo de anúncio.
- Preferir **link clicks/outbound clicks** a `clicks` totais para analisar visitas. Ações como reactions, messaging conversations e leads vêm em `actions` conforme campanha/atribuição; não prometer todos os tipos em todo anúncio.
- Um anúncio no Meta pode aparecer em Facebook e Instagram; a atribuição por plataforma pode exigir `breakdowns=publisher_platform` e nem toda combinação de métrica/breakdown é permitida. Identifique onde se está usando métricas agregadas do anúncio e onde há breakdown.
- Poll inicial e a cada 2–6 horas, com atualizações diárias para consolidar métricas; mudar frequência pela taxa de erro. Timezone da conta Meta. Dados de conversão podem mudar retroativamente: atualizar janela móvel de dias recentes. Páginas paginadas, retry com backoff, limites de API e mudanças de versão.
- A Meta **não** dispara webhook universal que diga sempre “um anúncio novo iniciou” com todas as métricas. O produto encontra novos anúncios via **sincronização/polling** e gera notificação interna de detecção.
- Autorização real pode depender de app, acesso da conta, escopos/permissões, revisão e regras de negócio. Implementar **CSV manual antes** de depender da aprovação.
- Não publicar/adicionar orçamento por API no MVP; somente leitura. Depois, criar anúncios PAUSED por API apenas com controle de permissões e aprovação explícita do proprietário.

### Meta Instant Forms (Lead Ads)
- Page webhook de `leadgen` pode notificar novos leads; geralmente notificação inclui ID que precisa ser buscado por API para detalhes autorizados. Identificar `leadgen_id`, `form_id`, `ad_id`, `created_time` quando presentes.
- Exigir configuração de subscriptions, `leads_retrieval` e outras permissões da documentação, acesso correto à Page/Business e política de privacidade. Implementar reprocessamento idempotente.

### Website + Meta Pixel + CAPI + GA4
- Instalar Meta Pixel/Events Manager na landing page, Google Tag Manager ou implementação controlada; medir `PageView`, `ViewContent` quando pertinente, `Lead` **apenas na confirmação real de formulário**; `Contact` para intenção qualificada e evento próprio para clique de WhatsApp como interação, não como lead garantido.
- CAPI opcional em momento seguinte. Se navegador e servidor emitirem **o mesmo evento**, ambos precisam compartilhar `event_name` e `event_id` (`eventID` no Pixel) para deduplicação. Não disparar Lead no clique do botão e novamente no envio com dois eventos diferentes representando uma mesma conversão.
- Em GA4, `generate_lead` quando entra um lead, `qualify_lead` quando CRM valida, `working_lead`, `close_convert_lead` em fechamento; respeitar padrões, privacidade e possibilidade real de associar cliente GA4 à origem. Documentar eventos internos na própria API do site independentemente de GA4.
- Capturar e persistir no backend no momento do formulário: landing path, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_id`, códigos internos, `fbclid` quando existir, `fbc`/`fbp` quando apropriado e permitido, data, consentimento, origem. **Não gravar PII em URLs, UTMs, GA4 custom dimensions ou Pixel custom_data sem propósito e autorização.**
- Para formulário do site, ideal: POST backend autenticado por medidas antispam/rate limit e validação, salvar `Lead`, gravar `LeadTouchpoint`, emitir evento interno, e emitir Pixel/GA4 com ID consistente apenas após sucesso; configuração e consentimento conforme legislação.
- `UTM example`: `?utm_source=facebook&utm_medium=paid_social&utm_campaign=cs_ms_quality_2026_11&utm_content=ad_a01&utm_id=cs-ms-q-2611`. O Meta pode oferecer parâmetros dinâmicos, testar exatidão antes de publicar. Para Instagram, source `instagram` quando possível. Mantenha nome fixo ao longo do teste; **não** embutir phone/email de visitante.
- `Landing page views` são reportadas pela Meta e `Sessions` pelo GA4 com definições distintas; não somar e não exigir igualdade.

### WhatsApp / Messenger
- Cliques em botão WhatsApp no site são **clicks**, não conversas confirmadas. Para registrar mensagem de verdade no app, integrar plataforma oficial WhatsApp Business Cloud API e webhooks em número elegível. Conectar um WhatsApp pessoal ou Business App sem API não garante acesso programático.
- Com números compartilhados/coexistência, confirmar configuração específica, quais mensagens são espelhadas e políticas. Não presumir captura de toda conversa antiga; não fazer scraping do WhatsApp Web.
- Atribuição de WhatsApp pode usar links rastreáveis, código de campanha e dados de referral do próprio webhook quando disponíveis, mas **nem sempre** há prova de qual anúncio originou a conversa. Registrar confiança da atribuição.
- Facebook Messenger/Instagram DMs requerem integrações e permissões próprias; não prometer DM/likes individualizados sem revisão da API e acesso.
- Modo manual: vendedor registra lead com origem sugerida e nível de certeza; link para thread externa se permitido, não importar conteúdo privado indiscriminadamente.

### Google Drive
- Google OAuth; escopo limitado `drive.file` quando aplicável; Drive API v3 uploads `resumable` para vídeos grandes. Salvar `drive_file_id`, `mime_type`, `bytes`, `sha256`, `folder_id`, `visibility`, `uploaded_at`. Criar pasta por marca/campanha/tipo para organização visual, mas manter identidade canônica no banco.
- Estrutura sugerida `/CS Campaign Lab/Cool Season/2026/CS-MS-QUALITY-2611/{scripts,video,images,exports}`. Links privados; servir previews por backend autenticado ou mecanismo com expiração, evitando tornar públicas pastas de clientes.
- OAuth token refresh criptografado; se upload falhar, status `UPLOAD_PENDING`, retry; não exibir arquivo “salvo no Drive” sem confirmação do ID.

### Marketplace / conteúdo orgânico
- Marketplace é **manual** e precisa respeitar a política vigente; serviços apresentados como listings de item podem não ser permitidos. Não criar API ou scraping para publicar/ler Marketplace. Registrar manualmente canal, URL se existente, data, criativo, gasto impulsionado documentado, contatos atribuídos e anotações.
- Facebook/Instagram orgânicos e Google Business Profile podem ser planos de distribuição distintos; acesso programático depende da API/permissão de cada um. Google Business Profile suporta Posts/Updates na interface; não confundir com Google Ads pagos.

### Google Ads futuro
- Implementar adaptador `AdPlatform` desde o início: `listAccounts`, `listCampaigns`, `listAds`, `getDailyInsights`, `normalizeActions`, `getConnectionHealth`.
- Em 2026 API Google Ads por Cloud project/OAuth com Explorer/Básico; modelos de metrics e quotas próprios. Desenhar campos comuns (`spend, impressions, clicks, conversions`) e campos específicos (`search_terms`, `click_id`), não forçar Google a usar ações da Meta. Google Ads Search pode ser próximo passo lógico para demanda ativa e HVAC local.

---

## 5. Banco de dados proposto (PostgreSQL + Prisma)

Estruture multi-brand desde o primeiro dia, mas com uma única conta inicial. Tabelas principais:

| Entidade | Campos essenciais | Notas |
|---|---|---|
| `User`, `Workspace`, `Membership` | userId, workspaceId, role | owner/editor/sales/viewer |
| `Brand` | name, domain, logo, timezone, currency, service_area | Cool Season primeiro; `America/New_York`, USD |
| `BrandDocument`, `PersonaVersion` | file id, title, version, approved, source | Rastreabilidade de alterações do brand kit |
| `ChannelAccount` | platform, external account/page ID, OAuth metadata, scopes, sync state | Tokens criptografados à parte |
| `CampaignPlan` | campaignKey, brandId, service, hypothesis, objective, status, start/end, plannedBudget | Conteúdo **interno** |
| `Experiment`, `ExperimentArm` | variable, primaryMetric, variants, status, decision, confidenceNotes | Testar ângulo mantendo serviço/destino semelhantes |
| `AdVariant` | adKey, campaignPlanId, angle, copy, headline, desc, CTA, script, version, personaVersionId | Variantes imutáveis por versão quando publicadas |
| `CreativeAsset` | variantId, type, sha256, driveFileId, duration, dimension, uploadStatus | Muitos assets/variant; usar join table se reuso |
| `PublishedAd` | variantId nullable, channelAccountId, externalAdId, remoteCampaignId, remoteAdSetId, externalStatus, URL | Um criativo → vários anúncios remotos; pendentes sem vínculo |
| `DailyAdInsight` | publishedAdId, date, breakdown, spend, impressions, reach, clicks, actions JSON, ingestedAt, source | Unique ad+date+breakdown+source+window; histórico de revisões opcional |
| `WebVisit`, `ConversionEvent` | session anon id, campaign IDs, UTM, timestamp, eventId | Separar eventos de leads |
| `Lead` | name, phone/email cifrados onde necessário, status, service, source, consent, createdAt | PII com acesso restrito, dedupe auditável |
| `LeadTouchpoint` | leadId, platform, campaign, variant, publishedAd, UTM, evidenceLevel, occurredAt | Multi-touch sem dupla contagem |
| `Appointment`, `Estimate` | leadId, scheduled/status, amount, sentAt, status | Um lead pode ter várias propostas |
| `Job`, `JobCost` | leadId, estimateId, contractAmount, directCosts, status, closeDate, payment status | Margem real, não apenas receita anunciada |
| `SyncJob`, `AuditLog`, `ImportBatch` | provider, job status, cursor, error, user changes, file sha | Monitoramento e replay |
| `AttributionRule` | brandId, model=last_non_direct/first/manual, lookbackDays | Padrão conservador, revisável |

Integridade: chaves UUID internas; `external_id` unique por plataforma+conta+tipo; valores monetários `Decimal`, moeda e timezone; soft-delete e audit log; indexes em (brand,date), external IDs, statuses, UTMs e join de leads. Retenção limitada de dados pessoais; permissões por workspace e papel.

---

## 6. Métricas indispensáveis e fórmulas

**Métricas Meta**: Spend, Impressions, Reach, Frequency, CPM=`1000*spend/impressions`, link CTR=`link_clicks/impressions`, link CPC=`spend/link_clicks`, outbound clicks, video plays e taxas assistidas (se disponíveis). `CTR` e `CPC` genéricos do provedor podem usar clicks totais: rotular corretamente.

**Métricas comerciais prioritárias**:

| Métrica | Fórmula | Origem e observação |
|---|---|---|
| Leads únicos válidos | contagem de `Lead` deduplicados e não spam | CRM; não somar Meta+GA4 |
| CPL real | gasto atribuído / leads únicos válidos atribuídos | uso de atribuição declarada |
| Taxa de qualificação | qualificados / leads únicos válidos | critério operacional configurável |
| CPQL | gasto atribuído / leads qualificados atribuídos | principal filtro de qualidade |
| Agendamento por lead | visitas marcadas / leads válidos | medir scheduled e attended separadamente |
| Taxa de orçamento | orçamentos enviados / leads qualificados | coorte e período alinhados |
| Close rate | contratos ganhos / propostas decididas ou enviadas | escolher denominador e mostrar explicitamente |
| CAC de mídia | gasto atribuível / clientes ganhos | usar lucro para tomar decisões, não só ROAS |
| Receita contratada | soma dos contratos ganhos (não recebimento) | distinta de cash collected |
| Margem bruta serviço | (receita - custos diretos) / receita | custo direto = equipamento, materiais, mão de obra de execução, terceiros, comissões diretamente atribuíveis etc. |
| Lucro de contribuição após mídia | receita - custos diretos - gasto atribuível de marketing | não equivale a lucro líquido (overhead/impostos ausentes) |
| ROI de mídia simples | (margem de contribuição pré-mídia - gasto)/gasto | permitir zero N/A; janela/coorte coerentes |
| ROAS | receita atribuída / gasto | receita não é lucro |
| Custo por visita realizada | gasto atribuível / visitas atendidas | importante para HVAC |

**Regras de qualidade:** divisões por zero = `N/D`, não 0; valores não recebidos não são cash flow; se anúncio tem gasto mas zero leads, CPL é `N/D` e reportar zero; coorte de leads por data de origem para indicadores de fechamento, relatórios de mídia por data de gasto (são janelas diferentes). Mover negócio entre status não cria novo lead. Recalcular atribuição ao unir duplicados. Guardar `source=Meta API/GA4/CRM/CSV/Manual`, latência, `last_sync`, confidence e janela de atribuição. Números Meta podem divergir dos fatos CRM por deduplicação, view-through, timing, bloqueios e cross-device.

### Tipos de lead no aplicativo
- `new` → `contacted` → `qualified` ou `disqualified` → `appointment_scheduled` → `appointment_completed` → `estimate_sent` → `won` ou `lost`.
- Atributos: `requested_service`, `homeowner_or_decision_maker` (informado espontaneamente, sem inferir), `zip_or_service_area`, `urgency`, `primary_priority` (qualidade/garantia/conveniência/preço/financiamento), `budget_constraint_if_provided`, `reason_lost` (price/scope/competitor/timing/no_reply/other).
- Vendedor não deve classificar “cliente ruim” por nacionalidade/idioma/renda; interesse pelo preço é legítimo. A qualificação diz respeito à adequação do serviço/escopo/decisão.

---

## 7. Estratégia de testes A/B inicial Cool Season

### Objetivo
Validar se **mensagem de qualidade e transparência** atrai um percentual maior de contatos qualificados e negócios com margem saudável do que uma abordagem centrada em preço.

**Nunca misturar variáveis desnecessariamente:** comparar mesma categoria de serviço, mesma área atendida, mesmo destino/CTA, mesma plataforma e período semelhante. Se trocar vídeo + serviço + público + landing ao mesmo tempo, não atribuir diferença ao texto.

### Plano sugerido
1. **Antes de publicar:** revisar oferta e claims, corrigir site, configurar UTMs, formulário testado e lead pipeline. Subir 3 vídeos padronizados de 20–35s de **mesmo serviço** (ex.: mini-split single-zone), ângulos A=instalação correta, B=clareza de escopo, C=tranquilidade/suporte. Não inventar garantia ou prazo; usar projetos reais quando possível.
2. **Meta primeiro:** Facebook Feed, Instagram Feed/Reels como placements conforme formato; Meta pode otimizar automaticamente entrega. Para comparação causal, usar divisão controlada via ferramenta de experimento da Meta quando disponível; caso contrário, tratar análise como **observacional**, não prova causal.
3. **Pelo menos 1–2 semanas por rodada**, ou tempo/amostra adequados ao gasto e volume. Evitar declarar ganhador com dois leads; observar qualidade, não só CTR. Orçamento deve ser limitado ao montante que a empresa aceita perder em teste e dividido sem fragmentação excessiva.
4. **Marketplace:** somente registro manual/alternativas permitidas; não comparar mensagens de listing não pago com resultado pago sem contextualizar.
5. **Check semanal:** mensagens, leads únicos, visita, cotações, preço, motivo de perda, margem. Marcar mudanças de copy, landing e oferta para não misturar versões.
6. **Próxima onda:** repetir ângulo vencedor em central HVAC / garage / sunroom; testar vídeo vs imagem separadamente. Se Meta tiver tráfego de baixa intenção mesmo após ajustes, planejar Google Search com leads de intenção ativa.

**Rótulos no dashboard de cada anúncio**: `TESTANDO`, `DADOS INSUFICIENTES`, `MELHOR QUALIDADE (PROVISÓRIO)`, `PAUSADO`, `ARQUIVADO`; jamais afirmar vitória só por likes/CTR. Uma regra de sugestão (não decisão automática) pode exigir piso configurável de gasto, leads e dias e explicar a amostra; não usar p-value falso.

---

## 8. Outros canais opcionais a preservar no catálogo

| Canal | Perfil típico / uso | Integração planejada |
|---|---|---|
| Meta Ads (Facebook/Instagram) | descoberta e consideração; vídeo, imagem, lead form e site | 1º: CSV; 2º API |
| Facebook Page/Instagram orgânico | portfólio, prova, conteúdo educativo e reviews | inicialmente manual; API com permissões futuras |
| Facebook Marketplace | histórico de leads sensíveis a preço; checar política para serviço | **manual e condicionado**; sem automação |
| Google Search Ads | pessoa pesquisando instalação ou substituição agora | fase posterior Google Ads API |
| Google Business Profile / Maps | reputação e validação; fotos, reviews, posts | inicialmente manual; integrações elegíveis futuras |
| Local Services Ads | alta intenção em categorias/regiões elegíveis; credenciamento/plataforma própria | manual/integração específica, não confundir com Google Ads Search |
| Nextdoor | proprietários locais/recomendações comunitárias | manual; avaliar mídia paga local |
| YouTube Shorts | educativo e portfólio; remarketing possível | manual/integração futura |
| Referral / QR / email | indicações rastreáveis por link/cupom próprio | tracking first party |

---

## 9. Segurança, permissões, privacidade e operação

- Backend HTTPS com Caddy/Traefik; login seguro e MFA se disponível; RBAC por marca; sem credenciais expostas no frontend.
- Guardar tokens OAuth **criptografados em repouso** e somente no servidor; rotação, revoke/disconnect, logs de consentimento e escopos.
- Verificar `X-Hub-Signature-256` de webhooks Meta, `hub.verify_token` no GET; proteger endpoint contra replay, retries e duplicação; armazenar event ID.
- Formulários: CAPTCHA/honeypot/rate limiting e validação; política de privacidade e consentimento/avisos adequados. Não enviar dados privados desnecessários ao GA4/Meta; revisar requirements da plataforma e legislação aplicável.
- Arquivos com limite de tamanho, MIME sniffing, checksum, scanning quando implementado; Drive privado e metadados no DB.
- Backup diário do PostgreSQL, retenção e teste periódico de restauração. Docker Compose com healthcheck; staging separado da produção. Exportar dados em CSV/JSON e deletar dado de lead quando exigido/aplicável.
- Fuso padrão `America/New_York`, datas da plataforma convertidas com timezone original. Dinheiro USD Decimal.
- Falhas de API não devem bloquear acesso às campanhas importadas. Relatórios mostram `última atualização` e `dados parciais`.
- **Não criar/gerar claims automáticos** com materiais que ainda não foram confirmados por proprietário (garantia, licença, reviews, preços, financiamento).

### Site público — lista inicial de revisão antes de rodar campanha
Observações baseadas em consulta em 14/11/2026 de `https://coolseasonllc.com/`, não auditoria técnica aprofundada:
1. Página menciona `flexible financing` embora proprietário tenha dito que não possui financiamento ativado. **Corrigir agora**.
2. Há múltiplos números de telefone publicados em seções diferentes; verificar números ativos e tracking antes de investir.
3. Há trechos de portfólio HVAC com texto de reforma de banheiro/encanamento, aparentemente conteúdo de template; substituir por projetos reais.
4. Claims sobre reviews, certificações, prazos e planos de manutenção devem ser conferidos antes de reproduzir em anúncio.
5. Testar formulário de contato ponta a ponta e validar se o lead chega no CRM com origem correta.

---

## 10. Endpoints internos sugeridos

```text
POST /api/auth/...                           login e session
GET|POST /api/brands                         workspaces/marcas
GET|POST /api/brands/{id}/documents          persona, brand kit
POST /api/import/campaigns/preview           valida TXT, diff
POST /api/import/campaigns/commit            importa apenas rascunhos
GET|POST /api/campaigns                      planos de campanha
GET|PATCH /api/campaigns/{id}                detalhes
GET|POST /api/variants                       textos/headlines
POST /api/assets/upload/init                 iniciar upload privado/Drive
POST /api/assets/upload/complete             confirmar driveFileId
GET|POST /api/published-ads                   vínculo externo
POST /api/published-ads/{id}/link             associar a variante
GET /api/analytics/overview                  agregado por marca e filtros
GET /api/analytics/variants                  resultado por variante
GET /api/analytics/funnel                    funil e coortes
GET|POST /api/leads                          CRM
PATCH /api/leads/{id}/status                 mudança de etapa auditada
GET|POST /api/estimates                      orçamento
GET|POST /api/jobs                           vendas e custos
GET /api/integrations/status                 estado real de conexões
POST /api/integrations/meta/connect          OAuth Meta
POST /api/integrations/meta/sync             job assíncrono read-only
GET|POST /api/webhooks/meta                  verificação e recebimento
POST /api/website/leads                      endpoint controlado do site
POST /api/website/events                     eventos internos
GET /api/reports/export                      CSV/JSON
```

**Não confiar em IDs do cliente para autorização**. Cada route verifica autenticação, autorização por workspace e acesso à marca.

---

## 11. Stack técnica (sugestão, ajustar ao código existente)

- Next.js App Router + TypeScript, React, Tailwind CSS, shadcn/ui para interface; gráficos Recharts ou equivalente.
- PostgreSQL + Prisma ORM para dados. Zod para validadores; `Decimal` financeiro e migrations reais.
- Auth com biblioteca estável já usada no projeto/Better Auth caso compatível; permissões `OWNER`, `EDITOR`, `SALES`, `VIEWER`.
- Workers de sincronização com Redis/BullMQ (ou cron confiável + DB job queue simples no MVP) para Meta/Drive/GA4; registrar attempts/backoff/erros; não bloquear requests HTTP.
- Docker Compose app+Postgres(+Redis), backup, HTTPS, `.env` e deploy na VPS Hostinger ou endereço em subdomínio `ads.SEUDOMINIO` (a ser configurado).
- Drive OAuth para mídia; Meta OAuth/Marketing API por conexão; Google Analytics Data API/Google Ads no futuro. Não consumir APIs diretamente do navegador.
- Primeiro inspecionar infraestrutura atual e reutilizar Next.js/Prisma/Postgres/Auth quando possível sem misturar bancos de dados do Social Video Creator por acidente; manter serviço, schema e permissões isolados.
- Manter provedores por `interface`: `AdsProvider`, `AnalyticsProvider`, `AssetStorageProvider`, `LeadInboxProvider`; modo fake/test isolado.

---

## 12. Critérios de aceitação / testes que Claude deve executar

1. Criar marca Cool Season, associar persona, ver no dashboard.
2. Importar TXT de exemplo com 3 anúncios: todos aparecem com copy, headline, script e angle corretos; reimportar duas vezes não duplica; mostrar erros caso campo obrigatório ausente.
3. Fazer upload de vídeo (no teste mock; Drive com token real apenas quando ativado), conferir thumbnail/arquivo ID; falha de OAuth preserva arquivo e sinaliza pendência.
4. Cadastro manual de publicação com `meta_ad_id` + atribuição à variante; dois anúncios remotos podem mapear à mesma variante sem duplicar os dados financeiros.
5. Importar CSV de Meta de exemplo; atualizar registro por remote ID+data; import repetido não soma gasto duas vezes.
6. Cadastrar dois touchpoints para a mesma pessoa: dashboard mostra **um lead único**, não dois; não unir indivíduos com falso positivo.
7. Marcar qualificação, orçar, fechar com receita e custo: margem e CAC recalculados com fórmula correta.
8. Comparativo por período, marca, plataforma, serviço, campanha e ângulo; `N/D` para métricas sem denominador.
9. Mostrar `DEMO` em todos os números fictícios e nenhum botão “Conectado” ou “Ativo” sem token validado.
10. Verificar login, RBAC, webhook signature, validação de import, upload seguro e backups.
11. Exportar pacote de campanha TXT preservando campos e versões; teste de roundtrip.
12. Mobile e desktop utilizáveis, loading/error/empty state reais.

---

## 13. Fontes públicas utilizadas nesta especificação (URLs, consulta nov. 2026)

**Meta**
- Marketing API Insights: https://developers.facebook.com/docs/marketing-api/insights/
- Graph API Ad (inclusive `effective_status`): https://developers.facebook.com/docs/graph-api/reference/adgroup
- Reference Marketing API: https://developers.facebook.com/docs/marketing-api/reference/
- Leads Webhooks: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen
- Verificação de webhooks: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- Limits Insights: https://developers.facebook.com/docs/marketing-api/insights/best-practices/
- Marketplace Content Library é para pesquisa, **não API geral de publicação comercial**: https://developers.facebook.com/docs/content-library-and-api/content-library-api/guides/fb-marketplace/
- Marketplace e negócios, análise regulatória pública: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52025DMA100044
- WhatsApp Business Platform: https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/

**Google**
- GA4 lead events: https://developers.google.com/analytics/devguides/collection/ga4/reference/events
- GA4 Data API: https://developers.google.com/analytics/devguides/reporting/data/v1
- Traffic source / UTMs: https://support.google.com/analytics/answer/11242870
- Drive resumable upload: https://developers.google.com/workspace/drive/api/guides/manage-uploads
- Drive OAuth `drive.file`: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Google Ads API: mudança de acesso de 2026: https://developers.google.com/google-ads/api/docs/api-policy/developer-token
- Google Ads API access levels: https://developers.google.com/google-ads/api/docs/api-policy/access-levels
- Google Business Profile posts: https://support.google.com/business/answer/7342169

**HVAC + empresa**
- Housecall Pro homeowner 2026 survey: https://www.housecallpro.com/resources/home-service-spending-report/
- ServiceTitan HVAC sales process: https://www.servicetitan.com/blog/hvac-sales-process
- Cool Season site consultado: https://coolseasonllc.com/
- Brand kit incluído: `Guia_Persona_Cool_Season_para_IA.md` + `Persona_Mestra_Cool_Season_HVAC_2026.pdf`.

**Nota sobre limitações de informação:** APIs/permissões, políticas de plataforma e serviços específicos podem mudar. Claude deve validar endpoint, versão, escopos e classificação da campanha no momento da implementação. As recomendações de teste são hipóteses e boas práticas, não taxas de conversão comprovadas para esta empresa.
