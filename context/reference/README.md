# Material de referência

Fonte para o `/kickoff` e para as specs. **Não é carregado em toda sessão**: leia sob demanda.

| Arquivo | O que é |
|---|---|
| `01_ESPECIFICACAO_PARA_CLAUDE.md` | Especificação funcional e técnica completa (MVP 1–3, modelo de dados, métricas, segurança) |
| `02_EXEMPLO_CAMPANHA_IMPORTAVEL.txt` | Exemplo do formato de importação `CSCAMP/1` |
| `03_PROMPT_INICIAL_CLAUDE.md` | Prompt original (ver decisões abaixo: algumas partes foram substituídas) |
| `05_PROTOTIPO_VISUAL.html` | Protótipo visual de referência (dados fictícios) |
| `brands/cool-season/` | Brand kit da primeira marca: guia de persona (vinculante para textos de anúncio) + PDF |
| `00_LEIA_PRIMEIRO.md` | Resumo do kit original |
| `04_PARSER_REFERENCIA.ts` | Parser base do `CSCAMP/1` (sem dependências); integrar com Zod, persistência e versões |

## Decisões do dono (2026-11-14) — têm prioridade sobre o prompt original
1. **App independente.** NÃO integrar com o Social Video Creator agora: repositório, banco, autenticação e deploy próprios. Integração futura só quando o dono pedir.
2. **Várias contas/marcas.** O dono entra no app e cadastra várias contas (marcas/empresas) dentro dele. Cool Season é a primeira, não a única. Multi-marca desde o primeiro dia (a especificação §5 já prevê `Workspace`/`Brand`).
3. **Hospedagem na VPS do dono**, acessível de qualquer lugar por HTTPS, com login.
4. Brand kit de cada marca é **dado do app** (carregado pela interface), não código. Os arquivos em `brands/cool-season/` servem de seed/referência.
5. **O app não pertence à Cool Season** e não se chama "CS Campaign Lab" (nome usado no material original). É uma plataforma independente multi-marca; a Cool Season é só uma das marcas. O material desta pasta foi escrito para a Cool Season: as regras comerciais dela valem só para ela.
