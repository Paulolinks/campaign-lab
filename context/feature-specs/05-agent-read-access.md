# Spec 05: Acesso do Claude (analista de marketing), só leitura

| Campo | Valor |
|---|---|
| Status | In Progress (implementado; aguardando deploy e a chave guardada no ambiente do Claude) |
| Aprovado | 2026-11-22, pedido do dono no chat: "A ideia é você ser o marqueteiro, é você conectar e ver o que tá certo, o que não tá" |
| Depende de | Spec 04 (Meta só leitura) |

## Por quê
O dono quer que o Claude trabalhe como o profissional de marketing: entrar no app sozinho, ler o histórico e os resultados
e trazer a análise, sem o dono exportar planilhas. O token da Meta continua só no servidor; o Claude lê o que o app já guardou.

## Histórias
- **US-1:** Como dono, em Integrações, crio uma chave "Acesso do Claude" que aparece uma vez só, vejo quando ela foi usada e posso revogar.
- **US-2:** Como Claude, com a chave, listo as marcas e baixo tudo de uma marca: persona, metas, planos e variantes, campanhas/conjuntos/anúncios da Meta
  **com o texto dos anúncios**, números por dia (todo o histórico ou `since`), totais por período, funil dos leads (etapas, orçamentos, contratos, margem) e decisões.
- **US-3:** Os leads saem **sem** nome, telefone, e-mail, endereço nem notas livres. As respostas do formulário saem sem os campos que identificam a pessoa.
- **US-4:** A sincronização da Meta passa a guardar o texto do anúncio (título, texto, descrição, botão, link, imagem/vídeo). Se a Meta recusar, os números continuam.

## Desenho
- Tabela `AgentAccessKey` (por workspace): só o SHA-256 da chave, últimos 4 caracteres, criada por, último uso, revogada em.
- Chave `clab_` + 32 bytes aleatórios. Lida do cabeçalho `x-agent-key` ou `Authorization: Bearer`.
- `GET /api/agent/v1/brands` e `GET /api/agent/v1/brands/{brandId}/export?since=AAAA-MM-DD&actions=1`. Só GET; nenhuma escrita no app nem na Meta.
- Só o dono (OWNER) cria ou revoga a chave; criação e revogação vão para o log de auditoria.
- `PublishedAd.creative` (Json) preenchido por `syncCreatives` em `meta-sync-service.ts`; normalização pura em `src/domain/agent-access.ts`.
- Do lado do Claude: ambiente de nuvem com acesso a `ads.coolseasonllc.com` e a chave guardada como segredo de rede (cabeçalho `x-agent-key`); a chave nunca passa pelo chat.

## Testes
- Unit: geração/leitura da chave, filtro de PII das respostas, normalização do texto do anúncio (link, vídeo, criativo dinâmico).
- E2E: dono cria a chave, a API responde 401 sem chave, exporta a marca sem nome/telefone do lead, revogar bloqueia.

## Tarefas
- [x] T1 Schema + migração (`agent_access_key`, `published_ad.creative`)
- [x] T2 Domínio + testes
- [x] T3 Sync guarda o texto do anúncio
- [x] T4 Rotas da API do analista
- [x] T5 Integrações: criar/revogar chave
- [x] T6 E2E
- [ ] T7 Deploy + chave no ambiente do Claude + primeira análise

## Fora de escopo
Escrever no app (tarefas e relatórios do Claude dentro do app) e rotina diária agendada: próxima spec.
