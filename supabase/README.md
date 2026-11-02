# Urutan SQL Supabase

Jalankan melalui SQL Editor sesuai urutan nama file:
1. `00_core.sql` — profil, role, kategori, server dan helper admin.
2. `01_boxcell_video.sql` — tabel `videos`, khusus BoxCell Videy (embed/download).
3. `02_telegram.sql` — tabel `telegram_items`, khusus Code Bot Telegram (Free/Paid, review dan download).
4. `03_vip_plans.sql` — paket VIP video.

Catatan: file ini adalah skema awal. Jalankan pada project Supabase baru atau pastikan migrasi sebelumnya tidak bentrok. Jangan pernah menaruh service-role key di frontend.
