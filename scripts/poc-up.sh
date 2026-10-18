#!/usr/bin/env bash
# Levanta la PoC local completa (ARCHITECTURE §16.5).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Falta Docker. En WSL, activa la integración WSL de Docker Desktop o instala docker-ce." >&2
  exit 1
fi

docker compose up -d --wait
node scripts/poc-keys.mjs

# pnpm poc:up --tunnel → expone la web QR por HTTPS para probar desde el móvil.
if [[ "${1:-}" == "--tunnel" ]]; then
  node scripts/poc-tunnel.mjs
fi
pnpm db:migrate
pnpm db:seed

cat <<MSG

  ComerceChat PoC
  ─────────────────────────────────────────────
  Panel comercio  http://localhost:3001   (owner@casapepe.test / poc1234)
  Web QR          $(grep -E '^WEB_QR_BASE_URL=' .env.local | cut -d= -f2-)
  API + Swagger   http://localhost:4000/docs
  Mailpit (OTP)   http://localhost:8025

MSG

exec pnpm dev
