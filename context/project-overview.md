# Project Overview

> **Carregado em toda sessão — mantenha com no máximo ~150 linhas.**
> Detalhes técnicos vão para `architecture-context.md`; detalhes de feature vão para `feature-specs/`.
> Especificação completa original: `context/reference/01_ESPECIFICACAO_PARA_CLAUDE.md` (ler sob demanda).

| Campo | Valor |
|---|---|
| Nome | Campaign Lab (nome provisório; pasta: ADS Manager). Plataforma independente, não pertence a nenhuma marca. |
| Dono / decisor | Paulo |
| Fase | MVP |
| Última atualização | 2026-11-14 |

## 1. Pitch (1–2 frases)
Para quem gerencia anúncios pagos de várias marcas, páginas e negócios, o Campaign Lab é uma plataforma web privada que organiza
ideias, campanhas, anúncios, criativos e leads de cada marca, sem misturar os dados entre elas. Diferente do Ads Manager, ele mostra qual
ângulo/criativo gera **clientes qualificados e contratos lucrativos**, não só cliques e mensagens.

## 2. Problema
- **Dor atual:** ideias de anúncio, textos, vídeos, anúncios publicados e resultados ficam espalhados (Meta, Drive, WhatsApp, cabeça). Não dá para saber qual anúncio trouxe venda com margem.
- **Como resolvem hoje:** Ads Manager (só métricas da plataforma), anotações soltas, planilhas.
- **Por que agora:** campanhas da Cool Season vão começar; o dono quer testar ângulos (qualidade × preço) com dados reais.

## 3. Usuários
| Persona | Quem é | Objetivo principal | Nível técnico |
|---|---|---|---|
| Dono (OWNER) | Paulo, dono das marcas | Planejar, importar, comparar e decidir campanhas de qualquer lugar | Médio |
| Vendedor/editor (depois) | Equipe | Registrar leads e propostas; editar criativos | Baixo |

A Cool Season / Comfort Time é **uma das marcas cadastradas**, não a dona do app. A persona dela ("The Careful Homeowner", em `context/reference/brands/cool-season/`) vale só para ela. Regras comerciais de uma marca (ex.: não anunciar financiamento) ficam nos dados da marca (termos proibidos, persona), nunca no código.

## 4. Objetivos e métricas de sucesso
| Objetivo | Métrica | Meta |
|---|---|---|
| Saber qual ângulo dá lucro | CPQL, CAC e margem por ângulo/variante visíveis no dashboard | Disponível no MVP 1 |
| Tudo num lugar | Campanhas, variantes, mídia, publicações e leads cadastrados no app | 100% das campanhas novas |
| Acesso de qualquer lugar | App na VPS com HTTPS e login, usável no celular | MVP 1 |

## 5. Não-objetivos (fora de escopo)
- Integrar com o Social Video Creator (só quando o dono pedir).
- Publicar anúncios ou mexer em orçamento pela API.
- Automação/scraping de Marketplace, Messenger ou WhatsApp pessoal.
- Respostas automáticas com IA sem aprovação.
- Fingir integração ativa ou mostrar número fictício sem rótulo `DEMO`.
- Gerar claims (garantia, licença, financiamento, preço, reviews) não confirmados pelo dono.

## 6. Escopo do MVP (MoSCoW)
| # | Funcionalidade | Prioridade | Spec |
|---|---|---|---|
| 1 | Login + várias contas/marcas (workspace multi-marca) | Must | a escrever |
| 2 | Marca + persona/brand kit (documentos versionados) | Must | a escrever |
| 3 | Campanhas planejadas, variantes de anúncio, experimentos | Must | a escrever |
| 4 | Importador TXT `CSCAMP/1` (preview, erros por linha, sem duplicar, versões) | Must | a escrever |
| 5 | Upload de mídia em storage local privado | Must | a escrever |
| 6 | Anúncios publicados (vínculo manual por ID remoto) + UTMs | Must | a escrever |
| 7 | Mini CRM: lead → qualificação → visita → proposta → ganho/perdido, receita e custos | Must | a escrever |
| 8 | Importação de CSV do Ads Manager + métricas manuais | Must | a escrever |
| 9 | Dashboard, comparativo por ângulo, relatórios exportáveis | Must | a escrever |
| 10 | Upload para Google Drive (OAuth) | Should | — |
| — | Meta API read-only (MVP 2); WhatsApp, Pixel/CAPI, GA4, Google Ads (MVP 3) | Won't (agora) | — |

## 7. Jornadas principais
1. Como dono, quero criar uma conta/marca e carregar a persona para que os anúncios sigam o brand kit.
2. Como dono, quero colar/importar um TXT com campanha e anúncios para não digitar tudo.
3. Como dono, quero ligar um anúncio publicado na Meta à variante interna para saber o resultado de cada ideia.
4. Como dono, quero registrar o lead até o contrato fechado para ver custo por lead qualificado e margem.
5. Como dono, quero abrir o app no celular e ver qual ângulo está ganhando.

## 8. Restrições
- **Prazo:** [NEEDS CLARIFICATION: existe data para a primeira campanha?]
- **Orçamento / custos de API:** só a VPS existente; MVP 1 sem APIs pagas.
- **Plataformas:** web responsiva (mobile-friendly), hospedada na VPS do dono (Hostinger), HTTPS, subdomínio próprio.
- **Legais / dados:** leads são dados pessoais (EUA/Geórgia): acesso restrito, PII criptografada onde necessário, sem PII em UTMs/Pixel/GA4.
- **Técnicas obrigatórias:** app independente (repo, banco, auth e deploy próprios); multi-marca desde o dia 1; dinheiro em `Decimal` USD; fuso padrão `America/New_York`.
- **Idioma:** interface do app em pt-BR; textos de anúncio (cliente final) em inglês americano.

## 9. Glossário do domínio
| Termo | Significado |
|---|---|
| Workspace | Conta do dono no app; contém várias marcas |
| Brand (marca) | Empresa anunciada (ex.: Cool Season) |
| CampaignPlan | Ideia/hipótese de campanha interna (`CAMPAIGN_KEY`); ≠ campanha da Meta |
| AdVariant | Texto/criativo de um anúncio (`AD_KEY`), versionado |
| PublishedAd | Ocorrência real numa plataforma, com ID remoto; uma variante pode ter vários |
| Angle (ângulo) | Mensagem testada (ex.: `INSTALLATION_QUALITY`, `ESTIMATE_TRANSPARENCY`) |
| CSCAMP/1 | Formato TXT de importação (spec §3) |
| Lead | Contato real no CRM, deduplicado; ≠ "lead" reportado pela Meta |
| CPQL | Custo por lead qualificado |
| DEMO | Rótulo obrigatório em todo dado fictício |

## 10. Perguntas em aberto
- [NEEDS CLARIFICATION: data da primeira campanha]
