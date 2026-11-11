-- =============================================================
-- Aman menghapus review tanpa menghapus riwayat cashi_orders.
-- Mendukung seluruh jenis pesanan Projectvid:
--   vip, review_download, dan vip_group.
-- Jalankan sekali melalui Supabase Dashboard > SQL Editor.
-- =============================================================

begin;

-- Pastikan kolom grup VIP tersedia (biasanya sudah dibuat oleh
-- vip_group_account_migration.sql).
alter table public.cashi_orders
  add column if not exists vip_group_id uuid
  references public.vip_groups(id) on delete set null;

-- Pesanan review yang masih menunggu pembayaran tidak boleh tetap aktif
-- setelah review dihapus. Tandai EXPIRED sebelum FK melepas review_id.
create or replace function public.expire_review_orders_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cashi_orders
     set status = 'EXPIRED',
         updated_at = now()
   where review_id = old.id
     and purpose = 'review_download'
     and status = 'PENDING';

  return old;
end;
$$;

revoke all on function public.expire_review_orders_before_delete()
  from public, anon, authenticated;

drop trigger if exists expire_review_orders_before_delete
  on public.review_items;

create trigger expire_review_orders_before_delete
before delete on public.review_items
for each row
execute function public.expire_review_orders_before_delete();

-- Pertahankan baris pesanan. Saat review dihapus, hanya review_id
-- yang menjadi NULL; order dan data pembayarannya tetap tersimpan.
alter table public.cashi_orders
  drop constraint if exists cashi_orders_review_id_fkey;

alter table public.cashi_orders
  add constraint cashi_orders_review_id_fkey
  foreign key (review_id)
  references public.review_items(id)
  on delete set null;

-- PENTING: pertahankan aturan untuk vip_group.
-- Review yang sudah dihapus boleh memiliki review_id NULL selama
-- statusnya bukan PENDING (termasuk SETTLED/EXPIRED/FAILED).
alter table public.cashi_orders
  drop constraint if exists order_target_check;

alter table public.cashi_orders
  add constraint order_target_check check (
    (
      purpose = 'vip'
      and plan_id is not null
      and review_id is null
      and vip_group_id is null
    )
    or
    (
      purpose = 'review_download'
      and plan_id is null
      and vip_group_id is null
      and (review_id is not null or status <> 'PENDING')
    )
    or
    (
      purpose = 'vip_group'
      and vip_group_id is not null
      and plan_id is null
      and review_id is null
    )
  );

commit;
