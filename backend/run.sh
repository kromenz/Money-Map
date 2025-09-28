#!/bin/sh
set -e

echo "== run.sh starting: NODE_ENV=${NODE_ENV:-development} =="

if [ ! -d /app/node_modules ]; then
  echo "node_modules not found -> running npm ci"
  npm ci
else
  echo "node_modules exists -> skipping npm ci"
fi

if [ "$FORCE_NPM_INSTALL" = "1" ]; then
  echo "FORCE_NPM_INSTALL=1 -> forcing npm ci"
  npm ci
fi

echo "Running prisma generate..."
npx prisma generate

if [ "${NODE_ENV:-development}" != "production" ]; then
  if [ "${SKIP_DB_PUSH:-0}" != "1" ]; then
    echo "Running prisma db push..."
    npx prisma db push
  else
    echo "SKIP_DB_PUSH=1 -> skipping db push"
  fi

  if [ "${SKIP_SEED:-0}" != "1" ]; then
    echo "Running prisma db seed..."
    npx prisma db seed || true
  else
    echo "SKIP_SEED=1 -> skipping seed"
  fi
fi

echo "Starting app (npm run ${START_SCRIPT:-dev})"
exec npm run ${START_SCRIPT:-dev}
