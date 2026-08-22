import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, Cloud, FileLock2, Laptop, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'SchoolDMS | Enterprise Document Management',
  description: 'SchoolDMS membantu sekolah menyimpan, mengatur, dan menyinkronkan dokumen secara aman di web, Google Drive, dan perangkat Windows.',
};

const features = [
  {
    icon: Cloud,
    title: 'Cloud document management',
    description: 'Simpan folder, dokumen, dan versi file sekolah dalam satu ruang kerja yang terorganisasi.',
  },
  {
    icon: Laptop,
    title: 'Multi-device synchronization',
    description: 'Hubungkan beberapa laptop dengan Device ID dan target folder yang terpisah agar setiap perangkat tetap akurat.',
  },
  {
    icon: ShieldCheck,
    title: 'Controlled Google Drive sync',
    description: 'Hubungkan Google Drive melalui OAuth dan kelola sinkronisasi sesuai izin akun serta file yang berlaku.',
  },
];

export default function PublicHomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-card/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="SchoolDMS home">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-slate-950 ring-1 ring-slate-200">
              <Image src="/schooldms-mark.png" alt="SchoolDMS" width={40} height={40} priority className="h-10 w-10 object-contain" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight">SchoolDMS</span>
              <span className="hidden text-xs text-muted-foreground sm:block">Enterprise Document Management</span>
            </span>
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover">
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-24">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-subtle px-3 py-1 text-xs font-medium text-primary">
            <FileLock2 className="h-3.5 w-3.5" />
            Secure school document workspace
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">Manage school documents with clarity and control.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-foreground-muted sm:text-lg">SchoolDMS membantu sekolah mengelola dokumen, folder, versi, berbagi file, dan sinkronisasi multi-perangkat dari satu workspace yang aman dan teratur.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover">
              Open SchoolDMS
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/terms" className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:bg-surface-hover">How it works</Link>
          </div>
          <div className="mt-8 grid gap-3 text-sm text-foreground-muted sm:grid-cols-2">
            {['Versioned documents', 'Device-scoped sync', 'Google Drive OAuth', 'Offline-safe cloud data'].map((item) => (
              <span key={item} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-success" />{item}</span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-xl shadow-primary/5 sm:p-7">
          <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-subtle"><Cloud className="h-5 w-5 text-primary" /></span>
              <div><p className="text-sm font-semibold">SchoolDMS workspace</p><p className="text-xs text-foreground-muted">Documents, devices, and sync status</p></div>
            </div>
            <div className="mt-5 space-y-3">
              {['My Files', 'Academic Documents', 'Administrative Records'].map((item, index) => (
                <div key={item} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                  <span className="flex items-center gap-3 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-primary" />{item}</span>
                  <span className="text-xs text-foreground-muted">{index + 1} synced</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-primary px-4 py-4 text-primary-foreground"><p className="text-xs font-medium uppercase tracking-[0.16em] text-primary-foreground/70">Sync protection</p><p className="mt-1 text-sm">Cloud files remain available when a laptop is offline.</p></div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl"><p className="text-sm font-medium text-primary">Built for school operations</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">A clear system for every document and device.</h2><p className="mt-4 text-sm leading-6 text-foreground-muted">SchoolDMS menggabungkan penyimpanan dokumen, kontrol akses, audit, dan sinkronisasi sehingga tim sekolah dapat bekerja dari web maupun laptop terdaftar.</p></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => <article key={title} className="rounded-2xl border border-border bg-card p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-subtle"><Icon className="h-5 w-5 text-primary" /></span><h3 className="mt-5 text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-foreground-muted">{description}</p></article>)}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-foreground-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© 2026 SchoolDMS. Enterprise Document Management.</p>
        <nav className="flex gap-4"><Link href="/privacy" className="hover:text-foreground hover:underline">Privacy</Link><Link href="/cookies" className="hover:text-foreground hover:underline">Cookies</Link><Link href="/terms" className="hover:text-foreground hover:underline">Terms</Link></nav>
      </footer>
    </main>
  );
}
