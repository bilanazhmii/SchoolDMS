#!/bin/sh
set -eu

# Secret-safe diagnostics: report presence only, never values or lengths.
node -e 'const names=["DATABASE_URL","SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","ALLOWED_ORIGINS","STORAGE_DRIVER"]; const out=Object.fromEntries(names.map(n=>[n,typeof process.env[n]==="string"&&process.env[n].trim().length>0])); console.log("Runtime environment presence:",JSON.stringify(out)); if(!out.DATABASE_URL||!out.SUPABASE_URL||!out.SUPABASE_SERVICE_ROLE_KEY){process.exit(78)}'

npx prisma migrate deploy
exec npm run start:prod
