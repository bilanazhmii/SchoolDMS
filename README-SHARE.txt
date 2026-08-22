SchoolDMS Sync Client
======================

Executable: SchoolDMS.Sync.exe

This package is self-contained for Windows x64. No separate .NET installation is required.

Setup
-----
1. Run SchoolDMS.Sync.exe.
2. Sign in with your SchoolDMS account.
3. Select only the local folder(s) you want to synchronize. Do not select a drive root such as E:\.
4. Keep the application running in the Windows tray for background sync.
5. Use Exit from the tray menu when you want to stop the background worker completely.

Safety and privacy
------------------
- A computer has a stable Device ID and its own registered target folders.
- A computer being offline does not delete files or folders stored in SchoolDMS.
- Removing one local target pauses only that target on this computer; it does not delete the cloud folder.
- Local changes are queued and uploaded when the connection is available.
- Remote changes are checksum-checked and do not silently overwrite a different local edit.
- Do not share this executable together with auth.json or any local application-data folder.
- Never place access tokens, refresh tokens, service-role keys, or Drive encryption keys in this folder.

Production checklist
--------------------
- Deploy the current backend and web application.
- Run Prisma migrations before enabling the Drive OAuth flow.
- Configure HTTPS and exact ALLOWED_ORIGINS.
- Configure DRIVE_TOKEN_ENCRYPTION_KEY and a different DRIVE_OAUTH_STATE_SECRET of at least 32 characters.
- Review the web Privacy Policy and Cookie Policy before public release.
