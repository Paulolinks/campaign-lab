#!/bin/sh
# Sends the current code to the VPS and rebuilds the app. Run from the project folder: sh scripts/deploy.sh
# Nothing on the server is deleted: the previous src/ is moved to .previous/src-<date> (rollback = move it back).
set -eu
SERVER="root@31.97.142.45"
DIR="/opt/campaign-lab"

node scripts/verify.mjs

STAMP="$(date +%Y%m%d-%H%M%S)"
ssh "$SERVER" "cd $DIR && mkdir -p .previous && if [ -d src ]; then mv src .previous/src-$STAMP; fi"
tar cf - package.json package-lock.json Dockerfile .dockerignore compose.traefik.yaml next.config.ts next-env.d.ts \
  tsconfig.json eslint.config.mjs vitest.config.ts playwright.config.ts prisma prisma.config.ts \
  src/app src/domain src/lib src/providers scripts \
  | ssh "$SERVER" "cd $DIR && tar xf -"
ssh "$SERVER" "cd $DIR && docker compose -f compose.traefik.yaml -p campaign-lab up -d --build && docker compose -f compose.traefik.yaml -p campaign-lab ps"
echo "Pronto: https://ads.coolseasonllc.com"
