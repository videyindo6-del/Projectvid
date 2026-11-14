# BoxCellink – perbaikan dan pembaruan

## Yang diperbaiki
- Tujuan menu BoxVidey dan tautan kategori diarahkan ke `/watch.html` (bukan kembali ke homepage).
- Pengunjung dapat membuka video dengan akses publik; konten login/VIP tetap mengikuti aturan aksesnya.
- Resolver thumbnail memprioritaskan URL poster yang diisi admin. Jika poster tidak tersedia, listing dapat menggunakan preview embed yang aman untuk provider iframe atau video.
- Preview MEGA/Google Drive/Videy dan provider embed lain dapat tampil pada kartu jika URL embed yang sesuai tersedia. Dropbox direct media juga didukung oleh resolver.
- Pesan kode diskon saat kapasitas klaim habis dibuat lebih jelas. Form admin diselaraskan dengan batas database 2–10 klaim, diskon 10–75%, dan minimal pembelian Rp7.000.
- Seluruh rekalkulasi `claimed_count` dan normalisasi `claim_limit` pada SQL diberi kondisi `WHERE` eksplisit. Ini memperbaiki sumber peringatan `UPDATE requires a WHERE clause` pada prosedur kode diskon.
- Dashboard admin menampilkan aktivitas withdraw dan percakapan support, serta CRUD pengumuman.
- Halaman Telegram menampilkan Top 10 BoxVidey dalam rail horizontal dan tombol review dibuat lebih tahan terhadap overflow pada layar kecil.
- Drawer navbar dipersempit, footer dibuat putih, dan widget bantuan memperoleh FAQ bertingkat.
- Admin dapat mengelola menu navbar tambahan: label, path/URL HTTPS, ikon Font Awesome, tag NEW/TREND/BETA, warna, visibilitas, dan urutan.

## SQL yang perlu dijalankan
Jalankan `supabase/site_nav_items.sql` di Supabase SQL Editor setelah skema utama dan migrasi notifikasi BoxCellink sudah diterapkan. File ini membuat tabel menu navbar dan memastikan pengumuman admin disalin ke notifikasi member.

Jika database belum menerapkan `supabase/BoxCellink-affiliate-wallet-notifications-FIXED.sql`, terapkan file tersebut terlebih dahulu karena fitur aktivitas withdraw, inbox notifikasi, dan sinkronisasi pengumuman memerlukan tabel serta kolom yang dibuat di sana.

## Catatan thumbnail
Untuk hasil paling stabil, isi kolom Thumbnail dengan URL gambar langsung (`.jpg`, `.png`, `.webp`, atau URL gambar publik). URL embed MEGA/Dropbox/Drive tetap dapat digunakan sebagai preview provider pada kartu jika provider mengizinkan iframe. Tidak semua link berbagi provider menyediakan file gambar poster secara langsung; kebijakan privasi/CSP provider tetap berlaku.

## Build dan deployment
- Proyek memakai `npm run build` untuk menyalin sumber root ke folder `public/`.
- Build sudah dijalankan setelah perubahan.
- Deploy melalui Cloudflare Pages seperti biasa setelah perubahan diunggah ke GitHub.
