# Code Standards

> Lido antes de escrever ou revisar código. Regra de ouro: **se uma ferramenta pode verificar, a ferramenta verifica**
> (formatter, linter, type checker, testes). Este arquivo cobre o que as ferramentas não pegam.

## 1. Ferramentas obrigatórias
| Objetivo | Ferramenta | Config |
|---|---|---|
| Formatação | Prettier (a confirmar na spec 02) | `.prettierrc` |
| Lint | ESLint 9 + `eslint-config-next` | `eslint.config.mjs` |
| Tipos | TypeScript `strict` | `tsconfig.json` |
| Testes | Vitest (unit/integração), Playwright (e2e, a confirmar) | `vitest.config.ts` |

Antes de declarar uma tarefa pronta: formatter + lint + type check + testes passando.

## 2. Nomes
- Arquivos: `kebab-case.ts`; componentes React `PascalCase.tsx`
- Variáveis e funções: camelCase — verbos para funções (`generateTrack`), substantivos para dados.
- Classes/Tipos/Componentes: `PascalCase`
- Constantes: `UPPER_SNAKE_CASE`
- Booleanos: `is/has/should/can` + adjetivo.
- Use os termos do **Glossário** em `project-overview.md`. Sem abreviações obscuras.

## 3. Design de código
- Funções pequenas com uma responsabilidade; arquivo acima de ~300 linhas é sinal para dividir.
- Prefira composição e funções puras; efeitos colaterais (I/O, rede, disco) nas bordas.
- Sem código morto, sem código comentado, sem `TODO` sem referência (use `TODO(#issue)` ou registre em `progress-tracker.md`).
- Não duplique: procure uma função existente antes de criar outra.
- Não otimize sem medir.

## 4. Erros e logs
- Nunca engula exceções em silêncio. Trate, ou propague com contexto.
- Erros de usuário → mensagem clara; erros internos → log com contexto, sem dados sensíveis.
- Valide toda entrada externa (usuário, API, arquivo) na fronteira do sistema.

## 5. Tipagem
- TypeScript `strict: true`; toda entrada externa validada com Zod na fronteira.
- Proibido: `any` e `@ts-ignore` sem comentário justificando.

## 6. Testes
- Pirâmide: muitos unitários, alguns de integração, poucos end-to-end.
- Local: `*.test.ts` ao lado do arquivo; e2e em `tests/`.
- Nome descreve comportamento: `test_returns_error_when_bpm_is_negative`.
- Padrão Arrange–Act–Assert. Um comportamento por teste.
- Sem chamadas reais a rede/APIs pagas em testes unitários (use mocks/fakes).
- Cobertura mínima em código novo de `src/domain`: 80% — mas qualidade > número.

## 7. Comentários e documentação
- Comente o **porquê**, não o **o quê**.
- Funções públicas: docstring/JSDoc curta com parâmetros, retorno e erros.
- Mudou comportamento visível → atualize README/`context/` no mesmo commit.

## 8. Dependências
- Antes de adicionar: existe na stdlib ou no projeto? É mantida? Licença compatível? Tamanho?
- Fixe versões. Registre o porquê em ADR se for dependência estrutural.

## 9. Git
- Branch por feature: `feat/NN-slug`, `fix/slug`, `chore/slug`.
- **Conventional Commits:** `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:` — ex.: `feat(mixer): add sidechain compression`.
- Commits pequenos e atômicos; cada commit deve compilar e passar nos testes.
- A IA só faz commit/push quando eu pedir.

## 10. Segurança
- Segredos só via variáveis de ambiente; `.env` no `.gitignore`.
- Queries parametrizadas; nunca concatene SQL/comandos de shell com entrada do usuário.
- Princípio do menor privilégio para chaves e tokens.

## 11. Proibido neste projeto
- Dinheiro em `number`/float: usar `Decimal` (Prisma) e moeda explícita.
- Lógica de negócio (métricas, importador, atribuição) dentro de componentes ou rotas: vai em `src/domain`.
- Chamar APIs externas do navegador; tokens só no servidor.
- Mostrar dado fictício sem o rótulo `DEMO` ou status "Conectado" sem token validado.
- Divisão por zero virar 0: métricas sem denominador retornam `N/D`.
- Rota sem checar sessão + acesso ao workspace/marca (não confiar em IDs vindos do cliente).

## 12. Exemplos do padrão da casa
```ts
// ✅ Bom — regra pura em src/domain, N/D explícito
export function costPerQualifiedLead(spend: Decimal, qualified: number): Decimal | null {
  return qualified === 0 ? null : spend.div(qualified); // null → UI mostra "N/D"
}

// ❌ Ruim — float, zero falso e lógica no componente
const cpql = qualified ? spend / qualified : 0;
```
