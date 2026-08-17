# Document Sync Client

Klien desktop penyegerakan Windows (WPF, .NET 8, MVVM, dependency injection) untuk SchoolDMS.

## Apa yang dilaksanakan

- Lapisan Clean Architecture: `App` (hos DI), `Core` (model/DTO/interface), `Features` (Login, Sync), `Infrastructure` (API, auth store, settings, file watcher, queue).
- **SyncEngine sebenar**: memproses kerja queue (Create/Update/Delete/Rename/Move), muat naik fail ke backend (`POST /files/upload`), padam/move bila fileId diketahui, dedup SHA256, auto-refresh token bila hampir luput, backoff retry.
- **FileMonitorService**: `FileSystemWatcher` dengan debounce 500ms + tapisan fail sementara.
- **Queue tahan lama**: SQLite (`%APPDATA%/DocumentSyncClient/sync-queue.sqlite`).
- **Auth**: `POST /auth/login` & `/auth/refresh` ke backend; sesi disimpan di `%APPDATA%/DocumentSyncClient/auth.json`.

## Build & Publish untuk Windows

Prasyarat: .NET 8 SDK (https://dotnet.microsoft.com/download).

```powershell
# Build (debug)
dotnet build DocumentSyncClient.sln

# Publish release (single exe, self-contained — tidak perlu .NET dipasang)
.\scripts\publish-win.ps1
# Hasil: .\publish\win-x64\DocumentSyncClient.App.exe
```

## Konfigurasi

Fail tetapan: `%APPDATA%/DocumentSyncClient/settings.json`

```json
{
  "ServerUrl": "http://localhost:3000",
  "SyncFolder": "C:\\Users\\Anda\\Documents\\SchoolDMS-Sync",
  "AutoSync": true,
  "AutoStartWindows": false,
  "NotificationEnabled": true,
  "RememberLogin": false
}
```

| Kunci | Maksud |
|---|---|
| `ServerUrl` | URL backend. Lokal: `http://localhost:3000`. Produksi (Render): `https://nama-app.onrender.com` |
| `SyncFolder` | Folder tempatan yang dipantau & disegerakkan |
| `AutoSync` | Hidupkan pemprosesan queue latar (default `true`) |
| `AutoStartWindows` | (pilihan) mula bersama Windows |
| `RememberLogin` | Ingat log masuk — menetapkan `AutoLogin` |

## Aliran kerja

1. Buka app → log masuk (email + password, dihantar ke `POST {ServerUrl}/auth/login`).
2. Tetapkan `SyncFolder` dalam settings.json (folder mesti wujud) atau tunggu UI tetapan.
3. Sebarang fail baharu/diubah/dipadam dalam folder itu diqueue (SQLite) dan disegerakkan ke backend.
4. Pada log masuk semula, kerja yang belum selesai (status Failed) dicuba semula dengan backoff.

## Nota

- Aplikasi WPF hanya berfungsi di **Windows**.
- Untuk produksi, pastikan `ServerUrl` menunjuk ke backend yang boleh diakses (jangan gunakan `localhost`).
