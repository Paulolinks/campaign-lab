# Campaign Lab

Plataforma privada para organizar, testar e analisar campanhas de anúncios de várias marcas: ideias, anúncios importados por TXT, vídeos e imagens, anúncios publicados (pelo ID real), leads, orçamentos, contratos e o dashboard de custo por lead qualificado e margem.

## Rodar no computador

Requisitos: Node.js 22.12+ e Docker Desktop ligado.

```bash
docker compose -f compose.dev.yaml up -d   # banco Postgres (porta 5434)
npm install
npm run db:migrate                         # cria as tabelas
npm run dev                                # http://localhost:3000
```

No primeiro acesso, abra http://localhost:3000/setup e crie a conta do dono. Em desenvolvimento não é preciso `.env`.

## Testes

```bash
npm test            # regras (importador, métricas, armazenamento)
npm run test:e2e    # navegador de verdade, num banco só de teste
node scripts/verify.mjs
```

## Onde está o quê

- `src/domain/`: regras puras (parser CSCAMP/1, plano de importação, métricas, UTMs, tipo de arquivo)
- `src/app/`: telas e rotas `/api`
- `src/providers/storage/`: armazenamento de mídia (local agora, Google Drive preparado)
- `prisma/schema.prisma`: banco de dados
- `context/`: documentação do projeto e material de referência

## Produção (VPS)

Endereço: **https://ads.coolseasonllc.com** · servidor `root@31.97.142.45`, pasta `/opt/campaign-lab`, atrás do Traefik que já existe lá.
Banco e arquivos próprios (não mexe nos outros apps). Backup diário do banco em `/opt/campaign-lab/backups` (guarda 14 dias).

Atualizar o app depois de mudar o código (na pasta do projeto):

```bash
sh scripts/deploy.sh
```

Ele roda a verificação, guarda a versão anterior do código em `/opt/campaign-lab/.previous/` (nada é apagado), envia o código novo e reconstrói. As migrações do banco rodam sozinhas. Ver erros no servidor: `docker compose -f compose.traefik.yaml -p campaign-lab logs --tail 50 app`.

O arquivo de configuração do servidor foi criado por `scripts/vps-setup-env.sh` (senhas geradas lá, nunca copiadas para cá).
