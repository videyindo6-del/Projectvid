# ProjectVID — audit dan perbaikan

## Perubahan pada paket ini

1. Menambahkan `supabase/PROJECTVID_MASTER.sql`, satu file SQL gabungan untuk instalasi Supabase BARU.
2. Menambahkan `SQL_RUN_ORDER.md` dengan urutan 23 langkah SQL dan daftar migration lama yang tidak perlu dijalankan ulang.
3. Menambahkan `supabase/content_delete_cleanup.sql` untuk menghapus data turunan konten melalui foreign key `ON DELETE CASCADE`.
4. Penghapusan review sekarang memverifikasi bahwa baris benar-benar terhapus dan menampilkan pesan yang jelas jika RLS/database menolak.
5. Penghapusan video sekarang memverifikasi hasil delete, memberi konfirmasi dampak, dan tidak diam-diam mengabaikan error.
6. `telegram-admin.html` diarahkan ke `review-admin.html`, karena katalog publik Telegram menggunakan `review_items`, bukan tabel legacy `telegram_items`. Ini mencegah admin mengedit/menghapus tabel yang tidak menjadi sumber katalog publik.
7. Menghapus `js/telegram-admin.js`, `css/telegram-admin.css`, `scripts/Up` (file kosong), dan `supabase/functions/change-account-email/Ms` (catatan SQL usang yang bukan Edge Function).
8. Build ulang `public/` dari source root.

## Aturan penghapusan

- Hapus `videos`: likes, komentar, balasan, reaksi komentar, dan riwayat tontonan ikut terhapus.
- Hapus `review_items`: likes, komentar, download secret, content secret, dan entitlement review ikut terhapus.
- `cashi_orders` sengaja dipertahankan sebagai bukti transaksi. Order review berstatus `PENDING` diubah menjadi `EXPIRED`, lalu `review_id` menjadi `NULL`.
- Data media yang berada di hosting/provider eksternal tidak dapat dihapus oleh SQL database. Penghapusan ini menghapus record database dan relasi internal; bukan file yang berada di layanan eksternal.

## Pengujian yang dilakukan di paket

- `unzip -t`: arsip sumber valid.
- `node --check`: seluruh file `js/*.js` lulus.
- HTML parser Python: seluruh 30 halaman root dapat diparse.
- Pemeriksaan keseimbangan kurung kurawal CSS: 33 stylesheet lulus.
- Pemeriksaan referensi asset lokal: tidak ditemukan referensi asset lokal yang hilang.
- Pemeriksaan sinkronisasi source/build: file CSS, JS, dan components di `public/` sama dengan source root setelah build.
- `npm run build`: berhasil, menghasilkan 30 halaman HTML di `public/`.

## Belum dapat diuji tanpa kredensial/project Supabase pemilik

- Eksekusi SQL pada database Supabase aktual dan validasi RLS terhadap role admin.
- Operasi CRUD live, pembayaran Cashi, webhook, dan pemeriksaan transaksi real.
- Penghapusan object di bucket Supabase Storage atau provider eksternal; project ini tidak memiliki pemetaan bucket/object yang bisa dipakai untuk menghapus file secara aman.

Jangan menyatakan semua fungsi produksi telah teruji hanya dari pemeriksaan statis ini.


## Audit lanjutan — universal embed dan katalog review Telegram

### Perubahan kode

1. Menambahkan `js/embed-support.js` sebagai resolver bersama untuk URL media langsung, kode iframe, Google Drive, Dropbox, OneDrive/SharePoint embed, MEGA, Telegram publik, YouTube, Vimeo, Dailymotion, Streamable, Loom, Wistia, Twitch, Facebook, TikTok, Videy, DoodStream, Streamtape, Mixdrop, Filemoon, Voe, Upstream, MP4Upload, Vidhide, serta iframe HTTPS generik.
2. Form **Video & Embed** mendeteksi provider otomatis, menampilkan preview, menyimpan URL embed yang sudah dinormalisasi, dan memutar direct video dengan elemen video alih-alih selalu memaksa iframe.
3. Form **Review Media Telegram** kini memiliki kolom embed utama dan galeri media yang dapat berisi gambar, video, audio, atau iframe. URL tujuan Telegram tetap disimpan di `review_download_secrets` (privat), bukan kolom publik.
4. Halaman review menampilkan preview embed; link Telegram asli tetap dikeluarkan melalui alur `/paste/:slug` hanya setelah fungsi `download-link` mengonfirmasi akses yang valid. Halaman paste memberi label khusus “Buka Media di Telegram” jika targetnya adalah Telegram.
5. Katalog Telegram, menu Media Telegram, dan rail Telegram pada halaman Watch disatukan ke `review_items`. Rail Watch tidak lagi membaca tabel legacy `telegram_items`; item mengarah ke halaman detail review `/r/:slug` dan riwayatnya menyimpan slug review.
6. Dashboard admin menghitung `review_items` sebagai Telegram Reviews, bukan `telegram_items` legacy. Tabel legacy dipertahankan di database untuk kompatibilitas data lama, tetapi tidak lagi menjadi sumber tampilan atau pengelolaan katalog Telegram.
7. Memastikan seluruh 30 halaman root memuat `page-i18n.js`; halaman tanpa navbar publik mendapat tombol bahasa ID/ENG tambahan. Kamus halaman diperluas untuk form embed, panel admin, dan alur Telegram review.
8. Menambahkan `EMBED_PROVIDER_SUPPORT.md` berisi daftar format dan batasan provider.

### Pemeriksaan statis dan uji resolver

- `node --check` seluruh file JavaScript: lulus.
- HTML parser seluruh 30 halaman root: lulus.
- Pemeriksaan kurung kurawal CSS: 33 stylesheet lulus.
- Uji resolver 11 kasus (Google Drive, Dropbox MP4, OneDrive embed/share, MEGA, Telegram publik, YouTube, Vimeo, direct MP4, DoodStream, generic iframe): 11/11 lulus setelah koreksi Dropbox `raw=1`.
- `npm run build`: berhasil; 30 halaman disalin ke `public/`.

### Batas pengujian

- Belum ada kredensial Supabase pemilik atau akses deployment, sehingga CRUD produksi, RLS, fungsi Edge `download-link`, transaksi, dan data aktual tidak dapat dijalankan dari sini.
- Provider pihak ketiga dapat memblokir iframe, meminta login, atau mengubah format URL. Untuk OneDrive, gunakan URL Embed resmi / kode iframe; tautan pendek `1drv.ms` saja tidak menjamin dapat diputar di iframe. Telegram hanya bisa di-embed untuk postingan publik.
- Perubahan ini belum diuji pada perangkat Android/Samsung secara live; uji browser langsung tetap diperlukan setelah deploy.

## Audit dan peningkatan Wallet / SaaS UI — 2026-11-13

### Perubahan
1. Navbar publik memakai wordmark `BoxCellink` tanpa ikon box; perubahan berlaku juga pada drawer dan fallback navbar. Styling wordmark dirapikan untuk lebar layar Android.
2. Footer dirapikan dengan treatment premium, navigasi lebih terstruktur, dan cookie notice yang lebih ringkas di mobile.
3. `wallet.html` dan `js/wallet.js` dibangun ulang: saldo deposit/affiliate, form alamat domisili accordion (desa, kecamatan, kabupaten/kota, provinsi), pilihan bank/e-wallet, opsi lainnya, nomor rekening, pemilik rekening, pengaturan rekening pencairan, tarik semua/manual, rincian fee/net, riwayat withdraw dengan ID dan status, total withdraw sukses, serta riwayat ledger.
4. Menambahkan `topup-checkout.html` dan `js/topup-checkout.js`: order top up diarahkan ke halaman QRIS jika Cashi mengembalikan `qrUrl`, menyediakan fallback halaman Cashi, dan memeriksa status lewat Edge Function `payment-status` sampai settlement/expired.
5. Panel admin affiliate/withdraw diperluas untuk menampilkan rekening dan rincian fee/net, serta aksi proses, sukses (dengan konfirmasi), kembalikan untuk revisi, dan reject dengan alasan.
6. Tombol Share to Earn pada detail Media Telegram memakai warna emas. Video BoxCellink native HTML5 menyediakan Share to Earn dan sesi bonus Rp2 setelah minimal lima menit playback terukur; reward dibatasi satu kali per pasangan referrer/penonton/video untuk mencegah klaim berulang.
7. Menambahkan migrasi `supabase/boxcellink_wallet_withdraw_v2.sql`. Jalankan setelah `BoxCellink-affiliate-wallet-notifications-FIXED.sql`; urutannya ditambahkan ke `SQL_RUN_ORDER.md`.

### Pemeriksaan yang dilakukan
- `npm run build`: lulus, 34 halaman HTML tersalin ke `public/`.
- `node --check`: 84 file JavaScript lulus.
- HTML parser: 34 halaman root lulus.
- Pemeriksaan keseimbangan kurung kurawal: 68 stylesheet lulus.
- Pemeriksaan referensi asset lokal dari HTML: 0 referensi hilang.
- Sinkronisasi source/build untuk komponen navbar/footer, wallet, admin, checkout, dan watch: lulus.
- Pemeriksaan ID DOM yang dipakai `js/wallet.js`: tidak ada ID yang hilang.

### Batas verifikasi produksi
- Migrasi SQL belum dieksekusi pada database Supabase pemilik; tidak tersedia akses/kredensial database atau PostgreSQL client pada lingkungan audit. Fungsi RPC baru perlu dijalankan melalui SQL Editor sesuai urutan dokumentasi.
- Cashi QRIS/webhook dan settlement belum dapat diuji dengan transaksi nyata tanpa konfigurasi API key dan project Supabase aktif.
- Bonus video hanya dapat mengukur elemen video HTML5 langsung. Iframe provider eksternal tidak mengekspos status playback yang dapat dipercaya sehingga tidak diberi reward.
- Fee withdraw dibuat Rp7.000 tetap per pengajuan sesuai asumsi dari instruksi. Konfirmasi nominal fee sebelum produksi bila kebijakan platform berbeda.
- Tidak dilakukan uji perangkat fisik Android atau deployment live; hasil mobile sudah ditangani secara responsif dan perlu smoke test setelah deploy.

## Cashi QRIS Utama compatibility fix — 2026-11-13

1. `supabase/functions/create-payment/index.ts`: QRIS Utama now calls `POST /api/create-order` with only `amount` and `order_id`; it no longer sends the invalid hard-coded `kode_channel: "CASHI"`. This follows Cashi's documentation, where `kode_channel` is optional and omitted for QRIS Utama.
2. `supabase/functions/cashi-webhook/index.ts`: HMAC-SHA256 verification now uses the exact raw HTTP request body, as Cashi's PHP/Node examples require. It no longer parses and re-serializes JSON before signature verification.
3. Review purchases, VIP purchases, VIP group purchases, and Wallet top-ups continue to share the same payment creation and settlement flow.

### Deployment required
- Deploy the updated `create-payment` and `cashi-webhook` Supabase Edge Functions.
- Ensure Supabase Edge Function secrets include `CASHI_API_KEY` and `CASHI_SECRET_KEY` (plus the normal Supabase service environment provided by Supabase).
- Configure Cashi webhook URL to the deployed `cashi-webhook` function URL.
- Keep QRIS Utama selected in Cashi dashboard. Do not configure a `kode_channel` value in this code for the main QRIS channel.
- Run one low-value test payment for each flow and verify `cashi_orders.status = 'SETTLED'` plus the corresponding wallet/VIP/review entitlement.

Live payment and webhook delivery still require deployment and merchant credentials; they cannot be proven by local static tests.
