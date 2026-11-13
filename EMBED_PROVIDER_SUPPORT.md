# ProjectVID — panduan sumber embed

Panel **Video & Embed** dan **Review Media Telegram** menggunakan resolver yang sama (`js/embed-support.js`). Admin dapat menempel URL biasa, URL embed, atau kode `<iframe>` dari provider.

## Provider / format yang dikenali

- Google Drive (`drive.google.com/file/d/...`, `open?id=...`, dan URL `uc?id=...`) → player preview Google Drive.
- Dropbox → tautan file media langsung memakai `raw=1` bila ekstensi file dapat dikenali.
- OneDrive / SharePoint → URL embed resmi atau kode iframe. Tautan berbagi `1drv.ms` biasa tidak selalu merupakan URL player dan perlu diganti dengan kode Embed dari OneDrive.
- MEGA → URL `/file/...` dikonversi ke `/embed/...`.
- Telegram publik (`t.me/channel/post`) → widget embed postingan publik. Posting privat, invite link, dan konten yang membutuhkan login tidak dapat dipratinjau secara publik.
- YouTube, Vimeo, Dailymotion, Streamable, Loom, Wistia, Twitch, Facebook, TikTok.
- Videy, DoodStream, Streamtape, Mixdrop, Filemoon, Voe, Upstream, MP4Upload, Vidhide.
- File video langsung: MP4, M4V, WebM, OGV, MOV, HLS/M3U8, DASH/MPD; file audio dan gambar umum.
- Kode iframe HTTPS generik dari provider lain.

## Alur Review Media Telegram

1. `review_embed_url` atau galeri berisi preview / embed media untuk halaman review.
2. `review_download_secrets.download_url` menyimpan tautan postingan Telegram asli atau tautan akses secara privat.
3. Tautan privat hanya dikeluarkan oleh fungsi `download-link` melalui halaman `/paste/:slug` setelah akses gratis yang valid, entitlement pembelian, atau otorisasi admin diverifikasi.
4. Katalog `/telegram.html`, menu **Media Telegram**, dan rail Telegram di halaman Watch semuanya membaca `review_items`, bukan tabel legacy `telegram_items`.

## Batasan yang perlu diketahui

Tidak ada resolver yang dapat menjamin semua URL dari semua situs bisa diputar di iframe. Provider dapat menolak embedding melalui X-Frame-Options/CSP, meminta login, membatasi wilayah, menghapus file, atau mengubah format tautan. Dalam kondisi itu, gunakan kode Embed resmi dari provider atau tautan sumber sebagai link, bukan memaksa player. Dukungan M3U8/MPD bergantung pada dukungan browser/player perangkat.

Untuk OneDrive di HP, bila menu aplikasi hanya menghasilkan tautan berbagi, buka OneDrive melalui browser dan gunakan menu **Embed** jika tersedia. Tempel kode iframe yang disediakan ke kolom embed ProjectVID.
