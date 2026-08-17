# SchoolDMS Frontend (Web)

Frontend Next.js 14 (App Router) untuk SchoolDMS — dashboard, explorer dokumen, dan log masuk Supabase.

## Env (disalin daripada .env.local)

```env
# Projek Supabase — kunci awam (anon) selamat di pendedahan klien
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# URL backend API (NestJS)
# Lokal:   http://localhost:3000
# Produksi (Render): https://nama-app.onrender.com  ← PENTING: tanpa ini API tidak bersambung
NEXT_PUBLIC_API_URL=https://nama-app.onrender.com
```

## Deploy di Vercel

1. Pautkan repo ke Vercel (New Project → Import).
2. Root directory: `web`.
3. Framework: Next.js (auto).
4. Set Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` → URL backend (Render)
5. Deploy. Setiap push ke branch main auto-deploy.

Nota:
- Cookie sesi guna `secure` hanya bila `NODE_ENV === 'production'` — berfungsi di HTTPS Vercel.
- Serverless Vercel tidak sesuai untuk hos API dengan upload fail besar (had body ~4.5MB) — backend sepatutnya dihoskan di Render (lihat `../docs/ARCHITECTURE.md`).

## Jalankan lokal

```bash
npm install
npm run dev
```
