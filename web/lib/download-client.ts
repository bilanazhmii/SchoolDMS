const WINDOWS_CLIENT_FILENAME = 'SchoolDMS-Sync-win-x64.zip';

export async function downloadWindowsClient(url: string): Promise<void> {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`Download gagal (${response.status}). Silakan coba lagi.`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = WINDOWS_CLIENT_FILENAME;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export { WINDOWS_CLIENT_FILENAME };
