# BoxCellink – Audit & Perbaikan Lanjutan (14 November 2026)

## Perbaikan yang diterapkan

1. **Navigasi Box Video**
   - Tombol utama BoxVidey/Box Video sekarang merupakan tautan langsung ke `/book-video.html`.
   - Tombol kategori dipisahkan menjadi kontrol buka/tutup submenu.
   - Semua kategori Box Video dibuat menuju `/book-video.html?category=<id>`.
   - Ada normalisasi tautan submenu untuk memperbaiki tautan lama yang masih menunjuk ke `watch.html` atau `videos.html`.
   - Komponen navbar diberi versi cache baru agar perubahan komponen tidak tertahan cache lama.
   - Halaman `watch.html` tetap menjadi tujuan setelah pengguna memilih video untuk ditonton.

2. **Ikon Translate**
   - Tombol bahasa dipaksa memakai ikon Font Awesome `fa-solid fa-language` saat navbar diinisialisasi.
   - Ikon Home tetap hanya digunakan untuk Dashboard, bukan tombol bahasa.

3. **Notifikasi**
   - Pemrosesan notifikasi dibatasi pada `user_id` akun yang sedang login.
   - Tombol tandai semua dibaca, hapus satu, dan hapus semua diberi status proses dan pesan sukses/gagal yang terlihat.
   - Aksi "Buka" tetap menandai notifikasi dibaca lalu melanjutkan ke tautan tujuan.
   - Kebijakan RLS diperbarui agar pengguna dapat mengubah status baca dan menghapus salinan notifikasi pengumuman miliknya sendiri.
   - Pengumuman utama di tabel `announcements` tidak ikut dihapus oleh aksi hapus notifikasi pengguna.

4. **Pengaturan Navbar Admin**
   - Form dipisah menjadi nama menu, tujuan, URL khusus, ikon, badge, visibilitas, warna, dan urutan.
   - Pilihan tujuan mencakup halaman umum BoxCellink serta URL khusus.
   - Disediakan saran ikon Font Awesome dan preview ikon; kelas ikon Font Awesome lain dapat dimasukkan manual.
   - Pilihan badge mencakup NEW, TREND, BETA, dan PROMO.
   - Penyimpanan menampilkan status proses dan pesan error dari Supabase, serta memeriksa hasil insert/update.
   - Form dibuat responsif agar kontrol tidak melebar keluar layar.

5. **Thumbnail Review Media dan BoxVidey**
   - Thumbnail menampilkan skeleton loading gelap saat gambar sedang dimuat.
   - Jika URL gambar gagal atau thumbnail tidak tersedia, kartu menampilkan fallback "Book Video" dan keterangan untuk memeriksa komentar.
   - Tampilan fallback tidak menggunakan blok putih kosong.
   - Halaman daftar review memakai stylesheet review yang sesuai dengan struktur kartu.

6. **Bahasa Indonesia / English**
   - `page-i18n.js` sekarang dimuat pada seluruh 35 halaman HTML.
   - Halaman tanpa navbar bersama tetap memperoleh tombol bahasa.
   - Kamus ditambah untuk pengaturan navbar, status notifikasi, dan status thumbnail yang baru.

7. **Ketahanan layout**
   - Ditambahkan aturan global agar input, select, textarea, gambar, tabel, dan form tidak melampaui lebar viewport.
   - Area tabel tetap dapat digulir horizontal pada layar kecil.

## Pemeriksaan statis yang lulus

- `node --check` untuk seluruh JavaScript di `js/` dan Cloudflare Pages Functions.
- `npm run build` berhasil; menghasilkan 35 halaman HTML ke `public/`.
- Pemeriksaan HTML untuk 35 halaman: tidak ditemukan ID duplikat atau gambar tanpa atribut `alt`.
- Pemeriksaan i18n: seluruh 35 halaman memuat `page-i18n.js`.
- Pemeriksaan navbar: tautan utama Box Video dan tautan kategori statis mengarah ke `/book-video.html`.
- Pemeriksaan sinkronisasi: hasil build `public/` cocok dengan sumber HTML, CSS, JavaScript, dan komponen.

## Langkah Supabase yang wajib dilakukan

Setelah migrasi wallet/notifikasi langkah 24 dan 25 selesai, jalankan ulang file:

`supabase/site_nav_items.sql`

File ini membuat/memperbarui tabel `site_nav_items`, mengizinkan badge PROMO, dan memperbarui RLS notifikasi agar tombol tandai dibaca dan hapus notifikasi milik pengguna dapat bekerja.

## Batas verifikasi

Audit ini dilakukan terhadap file proyek dan build statis. Tidak tersedia koneksi ke project Supabase pemilik, sehingga insert/update navbar dan operasi RLS belum dapat diuji pada database live. Tidak ada kredensial atau data uji yang digunakan. Kamus terjemahan lokal juga hanya dapat menerjemahkan teks yang telah memiliki pasangan di kamus; teks dinamis baru dari database perlu ditambahkan ke kamus jika belum tercakup. Pengujian akhir pada perangkat dan database produksi tetap diperlukan sebelum deploy.
