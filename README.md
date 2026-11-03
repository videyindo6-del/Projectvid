# BoxCellink — Watch, Watch Review, VIP & Cashi

## Fitur yang disiapkan
- Watch terpisah: video embed (Videy, Google Drive, DoodStream, dan provider lain), akses public/VIP.
- Watch Review terpisah: embed review, deskripsi, harga, dan link download privat (mis. PasteLink).
- VIP: katalog paket, tanggal kedaluwarsa, akses video VIP, serta penonaktifan iklan yang ditampilkan oleh website.
- Cashi: create-order, hosted checkout, webhook HMAC-SHA256, pemeriksaan status, idempotensi, dan aktivasi akses melalui RPC database.
- Admin: kelola embed Watch, kelola embed Review + link download, lihat paket dan transaksi Cashi.

## Instalasi
1. Buat project Supabase. Jalankan `supabase/schema.sql` lebih dahulu, lalu `supabase/migrations.sql` di SQL Editor.
2. Isi `js/config.js` dengan Supabase Project URL dan anon/public key.
3. Deploy website ke Cloudflare Pages / hosting static. Jangan buka via `file://`.
4. Install Supabase CLI, login, link project, lalu set secrets:

```bash
supabase secrets set CASHI_API_KEY=... CASHI_SECRET_KEY=...
supabase functions deploy create-payment
supabase functions deploy cashi-webhook --no-verify-jwt
supabase functions deploy payment-status
supabase functions deploy download-link
```

5. Atur URL webhook Cashi di dashboard merchant ke:
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/cashi-webhook`
6. Set API Key dan Secret Key Cashi hanya sebagai Supabase Edge Function secrets. Jangan pernah menaruhnya di HTML, JavaScript browser, atau Git.
7. Jadikan akun admin pertama dengan SQL:
`update public.profiles set role='admin' where id='UUID_USER_ANDA';`
8. Tambahkan paket VIP dari SQL / Supabase Table Editor. Harga Cashi harus Rp2.000–Rp10.000.000.

## Catatan penting
- Cashi webhook harus dikonfigurasi di dashboard merchant. Signature yang tidak valid ditolak.
- Checkout Cashi menggunakan `checkout_url`. Aktivasi VIP dan entitlement download hanya dilakukan setelah webhook terverifikasi atau status Cashi diperiksa server-side.
- URL download disimpan pada `review_download_secrets`, bukan tabel publik `review_items`.
- Embed pihak ketiga dapat tetap menampilkan iklan provider. VIP hanya menonaktifkan slot iklan yang dikontrol website ini; website tidak dapat menjamin penghapusan iklan internal Videy/DoodStream/provider lain.
- Sebelum production, lakukan transaksi uji Cashi (sukses, gagal, expired, webhook duplikat) dan uji RLS dengan akun user biasa serta admin.

## URL konten dan tampilan baru
- BoxVidey detail: `/v/SLUG` (contoh `/v/M91y`).
- Watch Review: `/r/SLUG` (contoh `/r/B81n`).
- Download / checkout review: `/d/SLUG`.
- Cloudflare Pages membaca file `_redirects` untuk rewrite URL bersih ke HTML internal.
- Admin > Watch Embed menyediakan judul, provider, embed URL, thumbnail, kategori, scope (semua/login/VIP), download ON/OFF dan link download.
- Admin > Embed Review menerima maksimal 10 URL gambar, deskripsi, konten setelah pembayaran, PasteLink, harga, dan status.
- Watch menampilkan embed, view, tanggal publish, like, komentar, share, community, maksimal 30 rekomendasi, banner slot setelah setiap 4 kartu, serta paginasi.
- Review menampilkan galeri geser, 12 konten per halaman, dan CTA Telegram; tidak ada slot iklan review.

### Catatan iklan dan provider
Adsterra memerlukan kode publisher/zone milik pemilik website. Tempelkan script banner, Social Bar, dan Popunder resmi dari dashboard Adsterra ke slot yang ditandai di `index.html`/`watch.html`; script iklan tidak dibuat-buat karena setiap akun memiliki ID berbeda. Browser, ekstensi, atau provider embed dapat membatasi popunder. Iklan internal provider (Videy/DoodStream) tidak dapat dijamin hilang oleh mode VIP.

### Catatan gambar review
Form menerima URL gambar publik (HTTPS). Untuk mengunggah file gambar langsung, siapkan Supabase Storage bucket dan kebijakan upload admin terlebih dahulu.


## Update VIP, Referral, dan Diskon (November 2026)

1. Jalankan `supabase/referral_vip_migration.sql` di Supabase SQL Editor setelah `schema.sql` dan `supabase/migrations.sql`.
2. Deploy ulang Edge Functions `create-payment`, `payment-status`, dan `cashi-webhook` dari folder `supabase/functions`.
3. Pastikan Secrets Supabase yang sudah dipakai project tetap tersedia: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CASHI_API_KEY`, dan `CASHI_SECRET_KEY`.
4. Email `saputrarevolution2@gmail.com` otomatis diberi role admin jika akun sudah ada. Jika akun belum ada, role admin diberikan saat email tersebut mendaftar.
5. Harga VIP baru: 1 hari Rp15.000, 2 hari Rp25.000, 5 hari Rp30.000, 7 hari Rp35.000, 15 hari Rp50.000, 30 hari Rp100.000.
6. Diskon VIP 20% berlaku untuk pembelian item berbayar di Review. Diskon referral 20% (2 pemakaian) atau 50% (4 pemakaian) tidak ditumpuk; sistem menggunakan diskon terbesar.
7. Link referral dapat dibuka melalui menu akun > Referral & Hadiah. Referral dihitung saat akun baru dibuat melalui URL `register.html?ref=KODE`.
