# ADR-0002: Stack igual à do publisher (Social Media Automation), app independente

| Campo | Valor |
|---|---|
| Status | Accepted |
| Data | 2026-11-14 |
| Decisores | Paulo |

## Contexto
O Campaign Lab é um app independente na VPS do dono. O dono já tem outro app, o `publisher`
(`D:\Social Media Automation\publisher`), e quer que os dois fiquem compatíveis para uma integração futura.
A especificação original já sugeria Next.js + TypeScript + PostgreSQL + Prisma + Docker Compose.

## Opções consideradas
1. **Mesma stack do publisher** (Next.js 16, React 19, Prisma 7 + Postgres, Better Auth, pg-boss, Zod 4, Tailwind 4, Vitest), banco separado.
2. Next.js + Postgres com outras bibliotecas (ex.: Redis/BullMQ, outra auth): funciona, mas diverge do outro app.
3. Módulo dentro do publisher: integração imediata, mas mistura banco, deploy e risco. Rejeitado pelo dono.

## Decisão
Opção 1. Mesmas bibliotecas e versões do publisher, repositório e banco próprios. Integração futura só por API HTTP autenticada.

## Consequências
- ✅ Uma stack só para manter; código e padrões reaproveitáveis entre os dois apps.
- ✅ Fila no próprio Postgres (pg-boss): sem Redis no MVP.
- ✅ Mesmo modelo de usuário/workspace facilita login único no futuro.
- ⚠️ Atualizar versões em um app pede checar o outro.
