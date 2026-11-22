# ADR-0003: Sincronização da Meta com agendador simples no Compose (sem pg-boss por enquanto)

| Campo | Valor |
|---|---|
| Status | Accepted |
| Data | 2026-11-22 |
| Decisores | Paulo (+ IA como consultora) |

## Contexto
A spec 04 precisa ler a Meta sozinha a cada algumas horas. O `architecture-context.md` previa um worker com pg-boss
para isso, mas ele nunca foi criado e hoje só existe uma marca com uma conta de anúncios. Uma sincronização
incremental são poucas chamadas GET e termina em segundos; a carga inicial do histórico, em até alguns minutos.

## Opções consideradas
1. **Agendador simples no Compose** — um contêiner leve (como o `backup` que já roda) chama a rota interna
   `POST /api/internal/meta-sync` (leads a cada 5 min, números a cada 3 h), com uma chave derivada do `BETTER_AUTH_SECRET`. A trava contra execução dupla fica numa
   tabela (`MetaSyncRun`). Prós: nenhuma dependência nova, mesmo padrão já em produção. Contras: o trabalho roda no
   processo web; sem fila nem retry fino.
2. **Worker com pg-boss** — prós: fila, retry/backoff, processo separado. Contras: dependência nova e um segundo processo
   Node para manter, sem necessidade com uma conta.
3. **Só botão manual** — simples, mas os números ficam velhos se o dono esquecer.

## Decisão
Opção 1 (aceita em 2026-11-22: o dono deixou o detalhe técnico com a IA). A chave do agendador é derivada do `BETTER_AUTH_SECRET`, então o servidor não precisa de segredo novo. A lógica da sincronização fica em `src/lib/meta-sync-service.ts`, sem depender de quem a chama,
para que um worker pg-boss possa chamá-la no futuro sem reescrever nada.

## Consequências
- ✅ Sincronização automática sem instalar nada novo.
- ⚠️ Uma carga longa ocupa o processo web por alguns minutos; aceitável com uma conta.
- 🔁 Revisitar quando entrar o Google Drive (upload em segundo plano) ou quando houver várias contas de anúncios: aí
  migrar para pg-boss.
