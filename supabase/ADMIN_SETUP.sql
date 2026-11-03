-- Jalankan sekali setelah akun admin selesai didaftarkan.
-- Ganti UUID di bawah dengan auth.users.id akun Anda (Supabase Dashboard > Authentication > Users).
-- Jangan gunakan email hard-coded di trigger atau frontend.
update public.profiles
set role = 'admin'
where id = 'GANTI_DENGAN_UUID_AUTH_USER';

-- Verifikasi hasil:
select id, full_name, role, vip_expires_at
from public.profiles
where id = 'GANTI_DENGAN_UUID_AUTH_USER';
