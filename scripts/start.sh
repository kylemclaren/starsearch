#!/bin/sh
# Sprite service entrypoint. TypeSafe is reached through the sprite gateway, which injects the key.
cd "$(dirname "$0")/.."
[ -d dist ] || bun run build
export PORT="${PORT:-8080}"
export TYPESAFE_API_URL="${TYPESAFE_API_URL:-https://api.sprites.dev/v1/gateway/typesafe/DPMhT7kqBrDbDwypc4Jc5w/v1/systemone}"
exec bun run server/index.ts
