#!/bin/sh
set -eu

# Secret-safe diagnostics: report presence only, never values or lengths.
node -e 'const names=["DATABASE_URL","DIRECT_URL","SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","ALLOWED_ORIGINS","STORAGE_DRIVER"]; const out=Object.fromEntries(names.map(n=>[n,typeof process.env[n]==="string"&&process.env[n].trim().length>0])); console.log("Runtime environment presence:",JSON.stringify(out)); if(!out.DATABASE_URL||!out.SUPABASE_URL||!out.SUPABASE_SERVICE_ROLE_KEY){process.exit(78)}; if(!out.DIRECT_URL) console.warn("DIRECT_URL is not set; Prisma migrations will fall back to DATABASE_URL.")'

if [ -n "${DIRECT_URL:-}" ]; then
  printf '%s\n' 'Running Prisma migrations through DIRECT_URL...'
else
  printf '%s\n' 'Running Prisma migrations through DATABASE_URL...'
fi

# Railway may start more than one deployment while the previous container is
# still shutting down. Supabase session mode then temporarily returns
# EMAXCONNSESSION. Retry briefly, but do not keep the healthcheck blocked forever.
# Set MIGRATIONS_REQUIRED=true when a deployment must fail unless migrations run.
migration_ok=false
attempt=1
while [ "$attempt" -le 5 ]; do
  if timeout 20s npx prisma migrate deploy; then
    migration_ok=true
    break
  fi
  code=$?
  printf 'Prisma migration attempt %s failed with exit code %s.\n' "$attempt" "$code" >&2
  if [ "$attempt" -lt 5 ]; then sleep 3; fi
  attempt=$((attempt + 1))
done

if [ "$migration_ok" != true ]; then
  if [ "${MIGRATIONS_REQUIRED:-false}" = "true" ]; then
    printf '%s\n' 'Prisma migrations failed and MIGRATIONS_REQUIRED=true; refusing to start.' >&2
    exit 1
  fi
  printf '%s\n' 'WARNING: Prisma migrations did not complete; starting NestJS so Railway healthcheck can recover. Retry migrations after database connections are available.' >&2
else
  printf '%s\n' 'Prisma migrations complete.'
fi

exec npm run start:prod
