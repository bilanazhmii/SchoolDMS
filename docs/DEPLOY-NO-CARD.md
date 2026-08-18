# Deploy SchoolDMS — Panduan Tanpa Kad Kredit

## Vercel 404: NOT_FOUND — Penyelesaian

Punca paling biasa: Vercel tidak kenal projek sebagai Next.js (Framework Preset "Other"),
atau root directory tidak diiktiraf. Gejalanya: build "berjaya" tetapi SEMUA route 404.

**Penyelesaian (satu pilihan — kedua-duanya sudah/senang dibuat):**

1. **`vercel.json` di ROOT repo** (SUDAH saya tambah):
   ```json
   { "rootDirectory": "web", "framework": "nextjs" }
   ```
   Selepas push, Vercel auto-detect Next.js + root `web`. **Redeploy** dahulu
   (Redeploy → jika mahu guna tetapan baru, buat "New Deployment" — kadangkala
   perlu "Redeploy" dengan pilihan **"Override Settings"** dikosongkan).

2. Semak di **Vercel → Project → Settings → General**:
   - Root Directory: `web`
   - Framework Preset: **Next.js** (bukan "Other")
   - Build Command: `next build` (default, biarkan kosong)
   - Output Directory: kosong (default)

3. Selepas itu **Redeploy** dan sahkan Deployment Log tiada "39ms build" (yang terlalu
   cepat = tanda tidak membina Next.js).

Nota: `framework: "nextjs"` dalam vercel.json mungkin perlu dikosongkan jika Vercel
merungut konflik — tinggalkan hanya `rootDirectory: "web"`.

---

## Render minta Kad Kredit — Alternatif Tanpa Kad

Render (walaupun free tier) kini minta **kad kredit untuk verifikasi akaun**.
Jika anda tiada kad, guna alternatif ini (disahkan tiada kad diperlukan):

### Pilihan 1: Runsite (disyorkan untuk backend)
- https://runsite.app — **Free to start · No credit card** · server EU
- Deploy Node.js (NestJS) terus, **managed Postgres + Redis + S3 built-in**
- `git push` → HTTPS URL; tiada cold start untuk app aktif

Cara:
1. Daftar di runsite.app (tiada kad).
2. Buat app → pilih Node.js → pautkan repo atau push code.
3. Set env (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGINS, STORAGE_DRIVER=supabase).
4. Dapat URL `https://<app>.runsite.app` → set sebagai `NEXT_PUBLIC_API_URL` di Vercel.

### Pilihan 2: Bonto
- https://bonto.dev/hosting/nodejs — **No credit card required**
- Node.js 18/20/22, 75 jam runtime/bulan, 512MB RAM
- Sesuai untuk ujian/development; bukan 24/7 (had jam bulanan).

### Pilihan 3: Waifly
- https://waifly.com/guides/free-nodejs-hosting — **no credit card, no trial**
- 300MB RAM, 1GB storage, 1 MySQL; proses berjalan berterusan.
- Pterodactyl panel; MySQL (bukan Postgres) — perlu tukar DATABASE_URL.

### Apa yang TIDAK berubah
- Web tetap di **Vercel** (percuma, tiada kad untuk free tier).
- DB tetap **Supabase Postgres** (percuma, tiada kad).
- Fail tetap **Supabase Storage** (percuma) — `STORAGE_DRIVER=supabase`.
- Sync-client tetap sama — cuma tukar `ServerUrl` ke URL backend baharu.

---

## Keputusan: pilih backend

| Platform | Kad? | Postgres? | Nota |
|---|---|---|---|
| Runsite | ✗ Tiada | ✓ Managed | Disyorkan; S3 built-in |
| Bonto | ✗ Tiada | ✗ | 75 jam/bulan |
| Waifly | ✗ Tiada | MySQL | Perlu tukar driver |
| Render | ✗* Minta kad | ✗ | Free tier tapi perlu verifikasi kad |
| Railway | ✗* Kredit sahaja | ✗ | Percubaan berhad |

Jika anda setuju **Runsite**, saya boleh:
1. Kemas kini `docs/ARCHITECTURE.md` (seksyen Deploy → Runsite).
2. Sediakan `runsite.yaml`/nota deploy Runsite untuk backend.
3. Beritahu langkah tepat di dashboard Runsite.

---

## Penyelesaian PASTI untuk Railway (Dockerfile di root — tiada kebergantungan Root Directory)

Jika Root Directory `backend` tidak berkesan di Railway anda, fail ini (sudah ada di repo):

- `railway.json` (root) → builder DOCKERFILE + start command
- `railway.Dockerfile` (root) → build dari `backend/`
- `.dockerignore` (root) → tolak `web/`, `sync-client/`, `.env`, artifak

Cara:
1. Push (sudah).
2. Railway → Settings → **Config-as-code → Add File Path** → `railway.json`
3. **Deploy → Redeploy**.
4. Selepas hijau: Network → Generate Domain → set `NEXT_PUBLIC_API_URL` di Vercel.
