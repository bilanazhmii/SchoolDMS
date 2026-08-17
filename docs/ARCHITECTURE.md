# SchoolDMS — Dokumentasi Seni Bina

Sistem Pengurusan Dokumen Enterprise untuk sekolah. Tiga komponen utama:

| Komponen | Teknologi | Peranan |
|---|---|---|
| `backend/` | NestJS 11 · Prisma 6 · PostgreSQL | API REST + keselamatan + storan + integrasi Google Drive |
| `web/` | Next.js 14 (App Router) · shadcn/ui · TanStack Query | UI dashboard + explorer dokumen |
| `sync-client/` | WPF .NET 8 (MVVM, Clean Architecture) | Klien desktop penyegerakan folder tempatan |

---

## 1. Kontrak API (semua respons dibalut)

Semua endpoint JSON membalut respons dalam bentuk:

```json
{ "success": true, "data": { ... } }
```

Kesilapan dibalas dengan kod HTTP standard (`400`, `401`, `404`, `500`).

### Pengesahan (`/auth`)
| Kaedah | Laluan | Penerangan |
|---|---|---|
| `POST` | `/auth/login` | email+password → Supabase `signInWithPassword` → `{ accessToken, refreshToken, expiresIn, email }`; pastikan `Profile` wujud |
| `POST` | `/auth/refresh` | `{ refreshToken }` → Supabase `refreshSession` → token baharu |
| `GET` | `/auth/me` | Profil pengesahan penuh (dengan roles+permissions) |

### Folder & Fail (`/folders`, `/files`, `/search`)
| Kaedah | Laluan | Penerangan |
|---|---|---|
| `GET` | `/folders/root` | Senarai folder akar pengguna |
| `GET` | `/folders/root/contents` | Kandungan akar: `{ folders, files }` (paginasi `page`/`limit`) |
| `GET` | `/folders/:id/contents` | Kandungan satu folder |
| `POST` | `/folders` | Cipta folder (`{ name, parentFolderId? }`) |
| `PATCH` | `/folders/:id` | Kemas kini folder |
| `DELETE` | `/folders/:id` | Padam lembut + rekod trash |
| `POST` | `/folders/:id/restore` | Pulihkan dari trash |
| `GET` | `/files/:id` | Metadata fail + versi |
| `POST` | `/files/upload?folderId=` | **Multi-fail** — multipart `files[]` → array fail dicipta |
| `GET` | `/files/:id/download` | Muat turun (stream lokal / info Drive) |
| `GET` | `/files/:id/stream` | Strim fail besar |
| `GET` | `/files/:id/versions` | Sejarah versi |
| `GET` | `/files/:id/preview` | Info pratinjau `{ previewUrl, streamUrl, canPreview }` |
| `POST` | `/files/:id/move` | `{ toFolderId }` — pindah fail |
| `POST` | `/files/:id/copy` | `{ toFolderId }` — salin fail + kandungan |
| `DELETE` | `/files/:id` | Padam lembut + trash |
| `POST` | `/files/:id/restore` | Pulihkan fail |
| `GET` | `/search?q=` | Carian folder+fail (penapis: folderId, mimeType, minSize, maxSize, startDate, endDate, visibility) |

### Google Drive (`/drive`)
| Kaedah | Laluan | Penerangan |
|---|---|---|
| `GET` | `/drive/connect` | Redirect ke OAuth Google (offline access) |
| `GET` | `/drive/callback` | Callback OAuth — simpan token dienkripsi |
| `GET` | `/drive/status` | `{ connected, about }` — semakan sambungan |
| `DELETE` | `/drive/disconnect` | Putuskan sambungan |
| `GET` | `/drive/account` | Maklumat akaun tersimpan |

### Lain-lain
- `GET /health` — status + sambungan DB
- `GET /api` — dokumentasi Swagger

---

## 2. Aliran Data

```
┌──────────────┐   REST (Bearer JWT Supabase)   ┌──────────────┐
│   web (Next) │ ──────────────────────────────▶ │   backend    │
│              │ ◀────────────────────────────── │   (NestJS)   │
└──────────────┘      { success, data }          └──────┬───────┘
                                                        │ Prisma
┌──────────────┐   REST (Bearer JWT Supabase)          ▼
│ sync-client  │ ──────────────────────────────▶  ┌──────────────┐
│ (WPF .NET 8) │   /auth/login · /auth/refresh     │ PostgreSQL   │
│              │   /files/upload · /files/:id      └──────────────┘
└──────────────┘   /files/:id/move                 
```

- **Pengesahan**: Supabase Auth ialah sumber kebenaran. Web log masuk terus ke Supabase (klien), token dihantar ke cookie httpOnly melalui `/api/auth/setSession`. Backend mengesahkan token dengan service-role key pada setiap permintaan ber-guard.
- **Sync-client**: log masuk melalui `POST /auth/login` (backend proksi ke Supabase), menyimpan sesi dalam JSON (`%APPDATA%/DocumentSyncClient/auth.json`), dan menghantar perubahan fail dengan token yang sama.
- **Storan fail**: `backend/storage/` (default `./storage`). Setiap fail ada `FileVersion` dengan `storagePath` (`files/{fileId}/v1`). Fail boleh juga disimpan di Google Drive (`googleDriveFileId`) — backend memilih storan berdasarkan kehadiran id Drive.

---

## 3. Data Model Utama (Prisma — 20 model)

- **Profile** — pengguna; pautan `supabaseAuthId` ke Supabase Auth; roles, department, status.
- **Role / Permission / UserRole / RolePermission** — RBAC penuh.
- **DriveAccount** — sambungan Google per pengguna; refresh token dienkripsi AES-256-GCM.
- **Department** — jabatan sekolah.
- **Folder / File** — hierarki; `relativePath`, `googleDriveId`, `sha256/md5`, `versionNumber`, `visibility` (PRIVATE/RESTRICTED/ORGANIZATION/PUBLIC), `syncStatus`, `deletedAt` (padam lembut).
- **FileVersion** — sejarah versi + lokasi storan.
- **Tag / FileTag / Favorite / Trash** — penandaan, kegemaran, tong sampah.
- **Device / SyncSession / SyncJob** — penyegerakan berbilang peranti.
- **QRToken / ShareLink** — perkongsian melalui QR & pautan.
- **AuditLog / Notification / Settings** — audit, pemberitahuan, tetapan.

Migrasi Prisma: `prisma/migrations/20260804154742_init` + `20260805004021_add_storage_path_to_file_version`.

---

## 4. Cara Menjalankan

### Prasyarat
- PostgreSQL berjalan, `DATABASE_URL` sah (backend).
- Projek Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (backend), `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (web).
- Pilihan: `GOOGLE_DRIVE_CLIENT_ID/SECRET/REDIRECT_URI` + `DRIVE_TOKEN_ENCRYPTION_KEY` — **tanpa ini backend tetap berjalan**, ciri Drive dilumpuhkan dengan amaran.

### Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy        # jalankan migrasi ke DB
npm run build
npm run start:prod               # port default 3000 (PORT untuk ubah)
```

### Web
```bash
cd web
npm install
cp .env.example .env.local      # jika wujud; set NEXT_PUBLIC_API_URL ke backend
npm run build
npm start                       # Next.js 14
```

### Sync-client (Windows)
```bash
cd sync-client/DocumentSyncClient
dotnet build DocumentSyncClient.sln
# Jalankan App/DocumentSyncClient.App — default server http://localhost:3000
# (boleh ubah dalam %APPDATA%/DocumentSyncClient/settings.json → ServerUrl)
```

---

## 5. Ujian & Pengesahan

- **Backend**: `npm test` (3 suite, 6 ujian) — auth login/refresh, folder root/contents, app controller.
- **Smoke test** (dibuktikan berjalan): `/health` → `{"status":"ok","database":"connected"}`; `/auth/login` tanpa body → 400; endpoint ber-guard → 401; Swagger `/api` → 200.
- **Build**: backend `npm run build` ✓ · web `npm run build` ✓ (14 route) · sync-client `dotnet build` ✓ (0 error).

---

## 6. Deploy ke Produksi (Percuma)

Topologi disahkan: **Web di Vercel** · **Backend di Render free** · **DB di Supabase Postgres** · **Fail di Supabase Storage**.

```
Vercel (web, HTTPS)  ── NEXT_PUBLIC_API_URL ──▶  Render free (NestJS)  ──▶  Supabase Postgres (DATABASE_URL)
                                                      │
                                                      └──▶ Supabase Storage (bucket dms-files)
sync-client (Windows)  ── ServerUrl ──────────────────┘
```

### A. Backend → Render free
1. Pautkan repo di Render: **New → Blueprint** (gune `backend/render.yaml`) atau **New → Web Service** (root `backend`).
2. Set Environment Variables (dashboard Render):
   - `DATABASE_URL` → connection string Supabase Postgres (Dashboard → Project → Connect) + `?sslmode=require`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ALLOWED_ORIGINS` → `http://localhost:3000,https://<domain-vercel>`
   - `STORAGE_DRIVER=supabase` (fail tahan lama; cakera free Render ephemeral)
   - `MAX_FILE_SIZE=50` (MB)
3. Deploy. Start command (`render.yaml`) menjalankan `prisma migrate deploy` sebelum boot.
4. Nota free tier: Render tidur selepas ~15 min tanpa request (request pertama lambat sedikit), RAM 512MB.

### B. Web → Vercel
1. New Project → pautkan repo → Root directory `web`.
2. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` → URL backend Render (cth. `https://schooldms-backend.onrender.com`).
3. Deploy. Cookie sesi sudah guna `secure` dalam produksi (HTTPS Vercel) dan `false` dalam dev.

### C. Sync-client (Windows)
1. `dotnet publish` guna `sync-client/DocumentSyncClient/scripts/publish-win.ps1` → `publish/win-x64/DocumentSyncClient.App.exe` (self-contained, single file).
2. Set `ServerUrl` di `%APPDATA%/DocumentSyncClient/settings.json` → URL backend Render.
3. Set `SyncFolder` → folder tempatan yang mahu disegerakkan.

---

## 7. Nota & Perkara Tertunda

- **Google Drive OAuth end-to-end** belum diuji dengan kredential sebenar (tiada dalam `.env`). Kod siap; apabila kredential ditambah, aliran connect → callback → upload perlu disahkan.
- **Kredential Supabase sebenar** diperlukan untuk ujian log masuk penuh; `POST /auth/login` hanya boleh dibuktikan pada lapisan kontrak (400 tanpa body, 401 tanpa token).
- **Deploy sebenar di Vercel/Render** ialah langkah pengguna (buat akaun, paut repo, set env seperti Seksyen 6) — kredential platform tidak boleh disediakan dari sini.
- **Had free tier**: Render tidur selepas idle (kelewatan pertama), RAM 512MB, saiz body upload dihadkan oleh `MAX_FILE_SIZE`.
- **Projek pendua** `sync-client/DocumentSyncClient/DocumentSyncClient.App/` (root) tidak dirujuk oleh `DocumentSyncClient.sln` (sln rujuk `App/DocumentSyncClient.App`). Ia pendua lama yang selamat dipadam, tetapi dikekalkan untuk semakan.
- Bahasa UI kekal Inggeris (mesej login dalam Bahasa Indonesia sedia ada tidak diubah — di luar skop kefungsian).
