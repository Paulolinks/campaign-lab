#!/bin/sh
# Creates the server's env file for compose.traefik.yaml with random secrets, ON THE SERVER.
# Secrets are generated here and never printed or copied anywhere. Does nothing if the file already exists.
#
#   sh scripts/vps-setup-env.sh ads.example.com
set -eu
HOST="${1:?usage: vps-setup-env.sh <domain>}"
FILE="$(dirname "$0")/../.env"

if [ -f "$FILE" ]; then
  echo "Já existe $FILE — nada foi alterado."
  exit 0
fi

umask 077
cat > "$FILE" <<EOF
APP_HOST=$HOST
BETTER_AUTH_URL=https://$HOST
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
TRAEFIK_NETWORK=root_default
TRAEFIK_CERTRESOLVER=mytlschallenge
MAX_UPLOAD_MB=500
EOF
echo "Criado $FILE para https://$HOST (segredos gerados no servidor, não exibidos)."
