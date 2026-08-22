import Link from 'next/link';

export const metadata = { title: 'Ketentuan Layanan' };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6">
      <article className="mx-auto max-w-3xl space-y-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <header>
          <p className="text-sm font-medium text-primary">SchoolDMS</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ketentuan Layanan</h1>
          <p className="mt-2 text-sm text-foreground-muted">Versi 1.0 · Terakhir diperbarui 22 Agustus 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Ruang lingkup</h2>
          <p>SchoolDMS adalah layanan pengelolaan dokumen sekolah yang menyediakan penyimpanan, pengaturan folder, versi dokumen, berbagi file, serta sinkronisasi antara web, Google Drive, dan perangkat desktop yang terdaftar. Dengan menggunakan layanan ini, Anda menyetujui ketentuan ini dan kebijakan privasi serta cookie yang berlaku.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Akun dan keamanan</h2>
          <p>Anda bertanggung jawab menjaga keamanan akun, perangkat, dan kredensial yang digunakan untuk mengakses SchoolDMS. Anda hanya boleh menghubungkan akun Google Drive yang Anda miliki atau yang penggunaannya telah diizinkan oleh organisasi. Segera hubungi administrator jika Anda menduga terjadi akses tanpa izin.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Google Drive dan sinkronisasi</h2>
          <p>Jika Anda menghubungkan Google Drive, SchoolDMS meminta izin OAuth yang ditampilkan oleh Google dan menggunakan akses tersebut untuk menjalankan fungsi sinkronisasi yang Anda aktifkan. Google tetap menentukan hak akses pada setiap file dan folder. Menghubungkan akun tidak memberikan hak kepemilikan atau hak menghapus terhadap file yang tidak boleh dikelola oleh akun tersebut.</p>
          <p>Perubahan yang berasal dari laptop terdaftar diperlakukan sebagai perubahan utama untuk sinkronisasi lokal. Perubahan dari web dapat memerlukan konfirmasi sebelum diterapkan ke perangkat. Perangkat yang offline atau dimatikan tidak dianggap menghapus file cloud, dan menonaktifkan target pada satu perangkat tidak otomatis menonaktifkan target perangkat lain.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Konten pengguna</h2>
          <p>Anda atau organisasi Anda tetap memiliki hak atas dokumen yang disimpan melalui SchoolDMS. Anda wajib memiliki hak, izin, dan dasar yang sah untuk menyimpan, membagikan, menyalin, atau menyinkronkan setiap konten. Dilarang menggunakan layanan untuk menyimpan konten yang melanggar hukum, hak kekayaan intelektual, privasi, kebijakan sekolah, atau kebijakan Google.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. Operasi file dan penghapusan</h2>
          <p>Fitur edit, copy, move, rename, dan Move to Trash pada Google Drive hanya berhasil jika akun Google yang terhubung mempunyai capability dan izin yang diperlukan pada item tersebut. Penghapusan di SchoolDMS menggunakan mekanisme Trash atau soft-delete sesuai konfigurasi layanan. Kegagalan provider eksternal, izin Google Drive, atau perangkat offline dapat menunda sinkronisasi tanpa menghapus salinan yang belum berhasil diproses.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Ketersediaan layanan</h2>
          <p>Kami berupaya menjaga layanan tetap tersedia, tetapi tidak menjamin layanan bebas gangguan. Gangguan dapat berasal dari pemeliharaan, jaringan, penyimpanan, Google Drive, perangkat pengguna, atau penyedia infrastruktur. Fitur sinkronisasi dirancang untuk mempertahankan data cloud ketika perangkat lokal tidak tersedia, tetapi pengguna tetap bertanggung jawab memiliki salinan dan prosedur pemulihan yang sesuai untuk dokumen penting.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Perubahan dan penghentian</h2>
          <p>Administrator dapat memperbarui fitur, menghentikan koneksi Google Drive, menonaktifkan target perangkat, atau membatasi akun yang melanggar ketentuan. Perubahan penting pada ketentuan akan ditampilkan pada halaman ini bersama versi dan tanggal pembaruan.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. Kontak</h2>
          <p>Untuk pertanyaan tentang akun, dokumen, akses, penghapusan, atau sinkronisasi, hubungi administrator SchoolDMS atau alamat dukungan yang tercantum pada konfigurasi organisasi Anda.</p>
        </section>

        <footer className="border-t border-border pt-5 text-sm text-foreground-muted">
          <Link href="/privacy" className="text-primary hover:underline">Kebijakan Privasi</Link>
          <span className="mx-2">·</span>
          <Link href="/cookies" className="text-primary hover:underline">Kebijakan Cookie</Link>
          <span className="mx-2">·</span>
          <Link href="/" className="text-primary hover:underline">Kembali ke SchoolDMS</Link>
        </footer>
      </article>
    </main>
  );
}
