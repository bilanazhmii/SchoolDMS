const WINDOWS_CLIENT_FILENAME = 'SchoolDMS-Sync-win-x64.zip';

/**
 * Starts a native browser download. The GitHub raw URL already serves the ZIP
 * with the official filename, so no cross-origin fetch/blob step is needed.
 */
export function downloadWindowsClient(url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = WINDOWS_CLIENT_FILENAME;
  anchor.rel = 'noopener noreferrer';
  anchor.className = 'sr-only';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export { WINDOWS_CLIENT_FILENAME };

export const WINDOWS_CLIENT_DOWNLOAD_URL = 'https://github.com/bilanazhmii/SchoolDMS/raw/client-download/SchoolDMS-Sync-win-x64.zip';
