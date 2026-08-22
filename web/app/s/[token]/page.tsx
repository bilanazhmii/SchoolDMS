"use client";

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, Download, ExternalLink, FileText, Folder, Image as ImageIcon, Link2, Music, ShieldAlert, Video } from 'lucide-react';
import { useParams } from 'next/navigation';
import { fetchShare, fetchSharedFolderContents, fetchSharedText, saveSharedText, shareDownloadUrl, sharePreviewUrl } from '../../../services/sharing';
import type { PublicShareFile, PublicShareFolder } from '../../../services/sharing';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function PublicShareShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2.5" aria-label="SchoolDMS home">
            <img src="/schooldms-mark.png" alt="SchoolDMS" className="h-8 w-8 rounded-lg object-contain" />
            <div><div className="text-sm font-semibold">SchoolDMS</div><div className="text-[10px] text-foreground-muted">Guest file access</div></div>
          </a>
          <span className="rounded-full bg-surface-active px-2.5 py-1 text-xs text-foreground-muted">Public share</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-center text-xs text-foreground-faint sm:px-6">
        Shared securely with SchoolDMS · <a className="hover:text-foreground" href="/privacy">Privacy</a> · <a className="hover:text-foreground" href="/terms">Terms</a>
      </footer>
    </div>
  );
}

export default function PublicSharePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const [data, setData] = useState<PublicShareFile | PublicShareFolder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!token) {
      setError('Tautan tidak valid.');
      setLoading(false);
      return;
    }
    fetchShare(token)
      .then((value) => { if (mounted) setData(value); })
      .catch((cause) => { if (mounted) setError(cause?.message ?? 'Tautan tidak ditemukan atau kedaluwarsa.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token]);

  return (
    <PublicShareShell>
      <div className="mx-auto max-w-3xl">
        {loading ? <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-foreground-muted">Memuat file share…</div>
          : error ? <div className="rounded-xl border border-border bg-card py-16 text-center"><ShieldAlert className="mx-auto mb-3 h-10 w-10 text-warning" /><p className="text-sm text-foreground-muted">{error}</p></div>
          : data?.type === 'file' ? <FileView data={data} token={token} />
          : data ? <FolderView data={data} token={token} /> : null}
      </div>
    </PublicShareShell>
  );
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-primary" />;
  if (mime.startsWith('video/')) return <Video className="h-5 w-5 text-primary" />;
  if (mime.startsWith('audio/')) return <Music className="h-5 w-5 text-primary" />;
  return <FileText className="h-5 w-5 text-foreground-muted" />;
}

function isTextLike(mime: string) {
  return mime.startsWith('text/') || /json|xml|javascript|typescript|csv|markdown/.test(mime);
}

function InlinePreview({ url, name, mime, onImageClick }: { url: string; name: string; mime: string; onImageClick?: () => void }) {
  if (mime.startsWith('image/')) return <button type="button" onClick={onImageClick} className="mb-5 block w-full cursor-zoom-in rounded-lg border border-border bg-black/5 p-2"><img src={url} alt={name} className="max-h-[30rem] w-full rounded object-contain" /></button>;
  if (mime.startsWith('video/')) return <video src={url} controls className="mb-5 max-h-[30rem] w-full rounded-lg bg-black" />;
  if (mime.startsWith('audio/')) return <audio src={url} controls className="mb-5 w-full" />;
  if (mime === 'application/pdf') return <iframe src={url} title={name} className="mb-5 h-[32rem] w-full rounded-lg border border-border" />;
  return <div className="mb-5 rounded-lg border border-dashed border-border bg-surface-active px-4 py-6 text-center text-sm text-foreground-muted">Preview inline belum tersedia untuk format ini. Gunakan tombol Buka atau Unduh sesuai izin link.</div>;
}

function FileView({ data, token }: { data: PublicShareFile; token: string }) {
  const [fullView, setFullView] = useState(false);
  const [text, setText] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const mime = data.file.mimeType ?? 'application/octet-stream';
  const editable = data.permission === 'EDIT' && isTextLike(mime);
  const canDownload = data.permission === 'DOWNLOAD' || data.permission === 'EDIT';
  const previewUrl = sharePreviewUrl(token);

  useEffect(() => {
    if (!editable) return;
    fetchSharedText(token).then(setText).catch(() => setEditMessage('File ini belum dapat dibuka sebagai teks.'));
  }, [editable, token]);

  async function save() {
    if (!window.confirm('Konfirmasi perubahan\n\nPerubahan ini akan disimpan sebagai versi baru di web dan dikirim ke laptop yang terhubung. Lanjutkan?')) return;
    setEditLoading(true);
    setEditMessage(null);
    try {
      await saveSharedText(token, text);
      setEditMessage('Perubahan berhasil disimpan sebagai versi baru.');
    } catch (cause) {
      setEditMessage(cause instanceof Error ? cause.message : 'Gagal menyimpan perubahan.');
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-active"><FileIcon mime={mime} /></div>
        <div className="min-w-0"><h1 className="truncate text-lg font-semibold text-foreground">{data.file.name}</h1><p className="mt-1 text-xs text-foreground-muted">{mime} · {formatBytes(data.file.size)}</p>{data.description && <p className="mt-2 text-sm text-foreground-muted">{data.description}</p>}</div>
      </div>

      <InlinePreview url={previewUrl} name={data.file.name} mime={mime} onImageClick={() => setFullView(true)} />

      {editable && <div className="mb-5 rounded-lg border border-border p-4"><div className="mb-2 text-sm font-semibold">Edit file</div><textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-56 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-xs" /><button type="button" onClick={save} disabled={editLoading} className="mt-2 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">{editLoading ? 'Menyimpan…' : 'Simpan perubahan'}</button>{editMessage && <div className="mt-2 text-xs text-foreground-muted">{editMessage}</div>}</div>}

      <div className="mb-5 grid gap-2 rounded-lg bg-surface-active p-4 text-xs text-foreground-muted sm:grid-cols-3"><div><div className="text-foreground-faint">Izin</div><div className="mt-1 font-medium text-foreground">{data.permission}</div></div><div><div className="text-foreground-faint">Kedaluwarsa</div><div className="mt-1 font-medium text-foreground">{data.expiresAt ? data.expiresAt.slice(0, 10) : 'Tidak ada'}</div></div>{data.downloadLimit > 0 && <div><div className="text-foreground-faint">Unduhan</div><div className="mt-1 font-medium text-foreground">{data.downloadCount} / {data.downloadLimit}</div></div>}</div>

      <div className="flex flex-wrap gap-2">
        <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover"><ExternalLink className="h-4 w-4" />Buka file</a>
        {canDownload ? <a href={shareDownloadUrl(token)} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"><Download className="h-4 w-4" />Unduh</a> : <span className="self-center text-xs text-foreground-muted">Role VIEW tidak mengizinkan unduhan.</span>}
      </div>

      {fullView && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setFullView(false)}><button type="button" className="absolute right-4 top-4 rounded bg-white/10 px-3 py-2 text-sm text-white">Tutup</button><img src={previewUrl} alt={data.file.name} className="max-h-[90vh] max-w-[95vw] object-contain" /></div>}
    </article>
  );
}

function FolderFileRow({ token, permission, item }: { token: string; permission: PublicShareFolder['permission']; item: PublicShareFolder['folder']['items'][number] }) {
  const mime = item.mimeType ?? 'application/octet-stream';
  const canDownload = permission === 'DOWNLOAD' || permission === 'EDIT';
  const canEdit = permission === 'EDIT' && isTextLike(mime);
  const previewUrl = sharePreviewUrl(token, item.id);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function beginEdit() {
    setEditing(true);
    setMessage(null);
    try { setText(await fetchSharedText(token, item.id)); }
    catch { setMessage('File teks belum dapat dibuka.'); }
  }

  async function save() {
    if (!window.confirm('Simpan perubahan file ini sebagai versi baru?')) return;
    setSaving(true);
    setMessage(null);
    try { await saveSharedText(token, text, item.id); setMessage('Perubahan berhasil disimpan.'); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Gagal menyimpan perubahan.'); }
    finally { setSaving(false); }
  }

  return (
    <article className="rounded-lg border border-border p-4">
      <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-active"><FileIcon mime={mime} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-foreground">{item.name}</div><div className="mt-1 truncate text-xs text-foreground-muted">{mime} · {formatBytes(item.size)}</div></div></div>
      <InlinePreview url={previewUrl} name={item.name} mime={mime} />
      {editing && canEdit && <div className="mb-3 rounded border border-border p-3"><textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-40 w-full rounded border border-border bg-surface px-3 py-2 font-mono text-xs" /><button type="button" onClick={save} disabled={saving} className="mt-2 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan perubahan'}</button></div>}
      {message && <div className="mb-3 text-xs text-foreground-muted">{message}</div>}
      <div className="flex flex-wrap gap-2"><a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover"><ExternalLink className="h-3.5 w-3.5" />Buka</a>{canEdit && <button type="button" onClick={() => void beginEdit()} className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover">Edit</button>}{canDownload && <a href={shareDownloadUrl(token, item.id)} className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover"><Download className="h-3.5 w-3.5" />Unduh</a>}</div>
    </article>
  );
}

function FolderView({ data, token }: { data: PublicShareFolder; token: string }) {
  const [current, setCurrent] = useState(data);
  const [trail, setTrail] = useState<PublicShareFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  useEffect(() => { setCurrent(data); setTrail([]); setFolderError(null); }, [data]);

  async function openFolder(folderId: string) {
    setLoading(true); setFolderError(null);
    try { const next = await fetchSharedFolderContents(token, folderId); setTrail((previous) => [...previous, current]); setCurrent(next); }
    catch (cause) { setFolderError(cause instanceof Error ? cause.message : 'Subfolder tidak dapat dibuka.'); }
    finally { setLoading(false); }
  }

  function goBack() { const previous = trail[trail.length - 1]; if (!previous) return; setCurrent(previous); setTrail((items) => items.slice(0, -1)); setFolderError(null); }

  const hasItems = current.folder.folders.length > 0 || current.folder.items.length > 0;
  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-subtle"><Folder className="h-5 w-5 text-primary" /></div><div className="min-w-0"><h1 className="truncate text-lg font-semibold text-foreground">{current.folder.name}</h1><p className="mt-1 text-xs text-foreground-muted">{current.folder.folders.length} subfolder · {current.folder.files} file di folder ini</p>{current.description && <p className="mt-2 text-sm text-foreground-muted">{current.description}</p>}</div></div>
      <div className="mb-5 flex items-center gap-2 rounded-lg bg-surface-active p-3 text-xs text-foreground-muted"><Link2 className="h-3.5 w-3.5" />Role link: <strong className="text-foreground">{current.permission}</strong><span className="ml-auto">Cloud share</span></div>
      {trail.length > 0 && <button type="button" onClick={goBack} disabled={loading} className="mb-4 inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs hover:bg-surface-hover disabled:opacity-50"><ArrowLeft className="h-3.5 w-3.5" />Kembali</button>}
      {folderError && <div className="mb-4 rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{folderError}</div>}
      {loading ? <div className="py-10 text-center text-sm text-foreground-muted">Memuat isi folder…</div> : !hasItems ? <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-foreground-muted">Folder ini belum memiliki file atau subfolder.</div> : <div className="space-y-3">{current.folder.folders.map((child) => <button key={child.id} type="button" onClick={() => openFolder(child.id)} className="flex w-full items-center gap-3 rounded-lg border border-border p-4 text-left hover:bg-surface-hover"><Folder className="h-5 w-5 shrink-0 text-primary" /><span className="truncate text-sm font-medium text-foreground">{child.name}</span><span className="ml-auto text-xs text-foreground-muted">Buka subfolder</span></button>)}{current.folder.items.map((item) => <FolderFileRow key={item.id} token={token} permission={current.permission} item={item} />)}</div>}
    </article>
  );
}
