import Link from 'next/link';

export const metadata = { title: 'Kebijakan Privasi' };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6">
      <article className="mx-auto max-w-3xl space-y-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <header><p className="text-sm font-medium text-primary">SchoolDMS</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Kebijakan Privasi</h1><p className="mt-2 text-sm text-foreground-muted">Versi 1.0 · Terakhir diperbarui 22 Agustus 2026</p></header>
        <section className="space-y-3"><h2 className="text-lg font-semibold">Ringkasan</h2><p>SchoolDMS adalah sistem pengelolaan dokumen dan sinkronisasi multi-perangkat. Kami menyimpan metadata akun, struktur folder, versi file, catatan sinkronisasi, serta file yang Anda atau organisasi Anda simpan ke layanan ini. File cloud tetap tersimpan ketika komputer sedang mati atau offline.</p></section>
        <section className="space-y-3"><h2 className="text-lg font-semibold">Data yang diproses</h2><p>Data dapat mencakup alamat email dan identitas profil, nama file dan folder, path relatif target, ukuran dan checksum file, versi dokumen, Device ID, hostname komputer, status perangkat, log aktivitas sinkronisasi, serta token OAuth Google Drive yang diperlukan untuk koneksi yang Anda minta.</p></section>
        <section className="space-y-3"><h2 className="text-lg font-semibold">Sinkronisasi dan Google Drive</h2><p>Jika Anda menghubungkan Google Drive, SchoolDMS menggunakan OAuth untuk mengakses Drive sesuai izin yang ditampilkan Google. Refresh token Drive disimpan dalam bentuk terenkripsi di server. Sinkronisasi dilakukan berdasarkan akun, device ID, dan target folder yang terdaftar. Komputer yang offline tidak dianggap menghapus file cloud. Disconnect Google Drive menghentikan koneksi Drive dan tidak secara otomatis menghapus file SchoolDMS.</p></section>
        <section className="space-y-3"><h2 className="text-lg font-semibold">Keamanan dan retensi</h2><p>Session web menggunakan cookie HttpOnly, Secure pada production, SameSite=Lax, dan kebijakan no-store pada endpoint autentikasi. Perubahan sinkronisasi diberi checksum dan dicatat sebagai event agar konflik dapat dideteksi. Kami mempertahankan dokumen dan versi sesuai konfigurasi organisasi, kebijakan Trash, dan permintaan penghapusan yang sah.</p></section>
        <section className="space-y-3"><h2 className="text-lg font-semibold">Kontrol pengguna</h2><p>Anda dapat memutus koneksi Google Drive, menghapus atau memulihkan file melalui Trash, menghapus target sinkronisasi pada satu komputer, dan menghubungi administrator untuk permintaan akses, koreksi, ekspor, atau penghapusan data. Menonaktifkan target pada satu device tidak menghapus salinan cloud atau target milik device lain.</p></section>
        <section className="space-y-3"><h2 className="text-lg font-semibold">Perubahan kebijakan</h2><p>Kebijakan ini dapat diperbarui ketika fitur, penyedia infrastruktur, atau persyaratan organisasi berubah. Versi dan tanggal terbaru akan ditampilkan pada halaman ini.</p></section>
        <footer className="border-t border-border pt-5 text-sm text-foreground-muted"><Link href="/cookies" className="text-primary hover:underline">Lihat Kebijakan Cookie</Link><span className="mx-2">·</span><Link href="/" className="text-primary hover:underline">Kembali ke SchoolDMS</Link></footer>
      </article>
    </main>
  );
}
