import { FC, useEffect, useState } from 'react';

import { Folder, Loader2, X } from 'lucide-react';

import { fetchRootFolders } from '../../services/explorer';
import type { FolderItem } from '../../types/explorer';

type MoveDialogProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  onConfirm: (folderId: string | null) => void;
  busy?: boolean;
};

const MoveDialog: FC<MoveDialogProps> = ({ open, title = 'Move items', onClose, onConfirm, busy = false }) => {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [destination, setDestination] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDestination('');
    setLoading(true);
    setLoadError(null);
    fetchRootFolders()
      .then(setFolders)
      .catch(() => setLoadError('Folder list could not be loaded.'))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="move-dialog-title">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="move-dialog-title" className="text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-xs text-foreground-muted">Choose a destination inside My Sync. The current folder is not changed until you confirm.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md p-1.5 text-foreground-muted hover:bg-surface-hover disabled:opacity-50" aria-label="Close move dialog"><X className="h-4 w-4" /></button>
        </div>

        <label className="block text-xs font-medium text-foreground-muted" htmlFor="move-destination">Destination</label>
        <select id="move-destination" value={destination} onChange={(event) => setDestination(event.target.value)} disabled={loading || busy} className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="">My Sync root</option>
          {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>

        {loading && <div className="mt-3 flex items-center gap-2 text-xs text-foreground-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading folders…</div>}
        {loadError && <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-xs text-danger">{loadError}</p>}
        {!loading && !loadError && folders.length === 0 && <p className="mt-3 flex items-center gap-2 text-xs text-foreground-muted"><Folder className="h-3.5 w-3.5" />No folders yet. Choose My Sync root.</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-border px-3 py-2 text-sm text-foreground-muted hover:bg-surface-hover disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => onConfirm(destination || null)} disabled={loading || busy || Boolean(loadError)} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Moving…' : 'Move here'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveDialog;
