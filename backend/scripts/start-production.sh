#!/bin/sh
set -eu

# Secret-safe diagnostics: report presence only, never values or lengths.
# DIRECT_URL is recommended for Prisma CLI migrations, but DATABASE_URL remains
# a safe fallback while the Railway variable is being added.
node -e 'const names=["DATABASE_URL","DIRECT_URL","SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","ALLOWED_ORIGINS","STORAGE_DRIVER"]; const out=Object.fromEntries(names.map(n=>[n,typeof process.env[n]==="string"&&process.env[n].trim().length>0])); console.log("Runtime environment presence:",JSON.stringify(out)); if(!out.DATABASE_URL||!out.SUPABASE_URL||!out.SUPABASE_SERVICE_ROLE_KEY){process.exit(78)}; if(!out.DIRECT_URL) console.warn("DIRECT_URL is not set; Prisma migrations will fall back to DATABASE_URL.")'

if [ -n "${DIRECT_URL:-}" ]; then
  printf '%s\n' 'Running Prisma migrations through DIRECT_URL...'
else
  printf '%s\n' 'Running Prisma migrations through DATABASE_URL...'
fi

if timeout 90s npx prisma migrate deploy; then
  :
else
  code=$?
  if [ "$code" -eq 124 ]; then
    printf '%s\n' 'Prisma migration timed out after 90 seconds. Check the Supabase connection mode and URL.' >&2
  fi
  exit "$code"
fi

printf '%s\n' 'Migrations complete; starting NestJS...'
exec npm run start:prod
