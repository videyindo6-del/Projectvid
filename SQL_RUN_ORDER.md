# Urutan SQL ProjectVID / BoxCellink

## Untuk Supabase BARU (belum ada tabel project)
Jalankan `supabase/PROJECTVID_MASTER.sql` satu kali dari Supabase Dashboard → SQL Editor, lalu jalankan langkah 24 dan 25 di bawah untuk modul wallet/affiliate. File master tidak memuat tabel wallet/affiliate tambahan. Jangan jalankan ulang pada database aktif karena `schema.sql` adalah schema dasar.

## Urutan file individual (jika memasang manual)

01. `supabase/schema.sql`
02. `supabase/migrations.sql`
03. `supabase/referral_vip_migration.sql`
04. `supabase/admin_features.sql`
05. `supabase/vip_group_account_migration.sql`
06. `supabase/review_social_interactions.sql`
07. `supabase/review_public_access_fix.sql`
08. `supabase/review_public_stats_rpc.sql`
09. `supabase/review_guest_comments_migration.sql`
10. `supabase/watch_video_orientation_migration.sql`
11. `supabase/watch_guest_comments_replies_migration.sql`
12. `supabase/watch_access_notice_rpc.sql`
13. `supabase/support_chat_migration.sql`
14. `supabase/admin_vip_discount_management.sql`
15. `supabase/final_hardening_migration.sql`
16. `supabase/vip_group_secret_hardening.sql`
17. `supabase/boxcellink_premium_expansion.sql`
18. `supabase/vip_groups_profile_link_refresh.sql`
19. `supabase/admin_vip_crud_fix.sql`
20. `supabase/admin_discount_claim_flow.sql`
21. `supabase/admin_discount_scope_and_crud_fix.sql`
22. `supabase/review_delete_preserve_orders.sql`
23. `supabase/content_delete_cleanup.sql`

## Untuk database yang SUDAH berjalan
- Jangan jalankan ulang `schema.sql` atau seluruh master SQL.
- Periksa daftar migration yang sudah pernah dijalankan di project tersebut.
- Jalankan migration yang belum ada saja, sesuai urutan di atas.
- Untuk mengaktifkan penghapusan konten berantai pada database yang sudah memakai seluruh migration sebelumnya, jalankan `supabase/content_delete_cleanup.sql` sebagai migration terakhir.

## File SQL yang tidak dimasukkan ke master
- `supabase/ADMIN_SETUP.sql` — perintah khusus untuk menaikkan akun admin; isi UUID asli akun admin sebelum dijalankan.
- `supabase/vip_admin_crud_premium_fix.sql` — migration VIP lama/duplikat; versi yang dipakai adalah `admin_vip_crud_fix.sql`.
- `supabase/vip_membership_timeline_migration.sql` — migration timeline VIP lama yang fungsinya sudah disertakan/diperbarui dalam `boxcellink_premium_expansion.sql`.

## Kebijakan penghapusan konten
- Hapus video: baris video, likes, komentar, balasan, reaksi komentar, dan watch history ikut terhapus melalui foreign key `ON DELETE CASCADE`.
- Hapus review Telegram: review, likes, komentar, download secret, content secret, dan entitlement konten ikut terhapus.
- Riwayat `cashi_orders` tidak ikut dihapus. Order review yang masih `PENDING` diubah menjadi `EXPIRED`; `review_id` dilepas (`NULL`) agar bukti transaksi tetap ada.
- Hapus data dari tabel tidak otomatis menghapus file di layanan eksternal atau bucket Storage jika file itu disimpan terpisah. Project ini menggunakan URL embed/thumbnail eksternal pada alur yang diaudit; URL eksternal tidak dapat dihapus oleh SQL.

## Verifikasi setelah menjalankan SQL
1. Hapus satu video percobaan dan pastikan row `videos` serta child rows hilang.
2. Hapus satu review percobaan dan pastikan row `review_items` serta child rows hilang.
3. Pastikan `cashi_orders` tetap ada dan pending order terkait review berubah menjadi `EXPIRED`.
4. Tes publikasi, edit, dan hapus dari panel admin; jangan hanya memeriksa pesan sukses di browser.


## Modul Wallet & Affiliate (jalankan setelah langkah 23)

24. `supabase/BoxCellink-affiliate-wallet-notifications-FIXED.sql` — tabel dasar saldo, aplikasi affiliate, withdraw, ledger, notifikasi, settlement deposit, dan pembelian saldo deposit.
25. `supabase/boxcellink_wallet_withdraw_v2.sql` — alamat bertingkat, data bank/e-wallet, fee withdraw Rp7.000, net diterima, status revisi, notifikasi admin, dan bonus Share to Earn video Rp2.

Jangan jalankan langkah 25 sebelum langkah 24. Migrasi ini bersifat additive dan harus diuji pada project Supabase target sebelum dipakai di produksi.
