# Laporan audit dan perbaikan — 18 November 2026

## Paket yang diaudit
`Projectvid-main.zip` yang diunggah pada percakapan ini.

## Temuan utama yang diperbaiki
1. **PasteLink tidak dapat dibuat/dibuka:** frontend memanggil `/api/pastelink`, tetapi Pages Function API belum ada. Ditambahkan `functions/api/pastelink.js` untuk create, edit, update, dan resolve; endpoint menggunakan service-role hanya di server, memverifikasi sesi member, validasi input, masa aktif, dan password PBKDF2.
2. **Route hasil PasteLink hilang:** URL hasil memakai `/pas/:slug`, tetapi handler route tidak tersedia. Ditambahkan `functions/pas/[slug].js` dan halaman `pastelink-view.html`.
3. **Link feed PasteLink:** route lama `/z/:slug` diarahkan ke `/pas/:slug` untuk post PasteLink agar tidak mengandalkan domain statis di database. Kartu feed kini memakai `/z/:slug` untuk AutoLink dan `/pas/:slug` untuk PasteLink.
4. **Tombol Buat PasteLink di halaman Post:** sebelumnya hanya menampilkan toast karena composer tidak ada. Sekarang diarahkan ke halaman form PasteLink.
5. **Tampilan hasil PasteLink:** dibuat halaman premium yang menampilkan badge PasteLink kuning, judul, waktu dibuat, isi teks dengan baris baru tetap terjaga, dan URL di dalam konten menjadi tautan aktif. Konten ber-password meminta password sebelum ditampilkan.
6. **Edit PasteLink:** pilihan masa kedaluwarsa yang tidak disentuh saat edit kini dipertahankan, tidak otomatis dihapus.
7. **Member online:** RPC presence mengecualikan akun yang diblokir dari hitungan member online.

## Yang sudah ada dan diverifikasi secara statis
- Feed komunitas tunggal menggunakan `social_posts`, `social_post_likes`, dan `social_post_comments`; card sudah memuat nama/username/waktu, tipe AutoLink/PasteLink, tombol suka, komentar, bagikan, dan salin.
- CSS feed membedakan AutoLink hijau dan PasteLink kuning serta membuat tombol aksi satu baris yang dapat digeser horizontal pada layar kecil.
- Dashboard member sudah memiliki statistik AutoLink (total link, WIF valid, saldo, CPM), Top 10 Telegram, Telegram terbaru/terlama, Top 10 BoxVidey, dan BoxVideo terbaru/terlama dalam rail horizontal.
- Penghasilan AutoLink di sisi server baru dicatat oleh `record_autolink_ready_redirect` saat tombol Redirect Final memanggil aksi `ready`; kunjungan Go dan tahapan task hanya mencatat visit/progress.
- Admin member sudah menampilkan akun terdaftar, member online, pengunjung online, status keanggotaan, Game ID, last seen, dan saldo publisher.
- Migration PasteLink sudah memiliki trigger sinkronisasi PasteLink dan AutoLink ke social feed, serta notifikasi admin saat publisher withdraw dibuat dengan username, Game ID, metode/provider bank, nama pemilik rekening, nomor rekening, dan nominal.
- Ikon komunitas menggunakan URL dari `js/community-links-config.js`; URL Telegram, WhatsApp, dan YouTube terisi pada source.

## Pengujian lokal
- Arsip ZIP sumber dapat dibaca dan `unzip` test tidak menemukan kerusakan.
- `npm run build`: lulus, 54 halaman HTML disalin ke `public/`.
- `node --check`: 138 file JavaScript/ES module lulus setelah perbaikan.
- HTML parser: 54 halaman root lulus.
- Pemeriksaan kurung kurawal CSS: 41 stylesheet lulus.
- Pemeriksaan referensi aset lokal dari halaman HTML: tidak ada referensi aset lokal yang hilang.
- Smoke test API PasteLink dengan mock auth/database: create dan resolve dengan password berhasil; kode yang dihasilkan 8 karakter.
- Pemeriksaan frontend: tidak ditemukan `SUPABASE_SERVICE_ROLE_KEY` atau `service_role` di file frontend.

## Urutan database yang wajib
Lihat `SQL_RUN_ORDER.md`. Untuk fitur yang diminta, pastikan migration berikut sudah diterapkan pada Supabase:
- `account_center_v1.sql`
- `BoxCellink-affiliate-wallet-notifications-FIXED.sql`
- `boxcellink_wallet_withdraw_v2.sql`
- `autolink_publisher_monetization_v1.sql`
- `autolink_dashboard_withdraw_fix.sql`
- `social_posts_v1.sql`
- `pastelink_v1.sql`
- `member_presence_v1.sql`

Jangan jalankan ulang schema/master SQL pada database aktif. Jalankan hanya migration yang belum diterapkan. `member_presence_v1.sql` dapat dijalankan ulang untuk memperbarui definisi RPC.

## Batas verifikasi
Belum ada akses ke Supabase pemilik, Secret Cloudflare, maupun situs produksi. Karena itu migrasi live, RLS live, transaksi withdraw, webhook Cashi, dan interaksi nyata antar-akun belum dapat diuji. Setelah deploy, tes dua akun berbeda untuk create PasteLink, password, edit, expiry, like, komentar, share, dan akses feed. Tes AutoLink harus memastikan saldo hanya bertambah sesudah tombol Redirect Final berhasil diproses server.
