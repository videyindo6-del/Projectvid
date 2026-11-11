-- =============================================================
-- Aman menghapus review tanpa menghapus riwayat cashi_orders.
-- Jalankan sekali melalui Supabase Dashboard > SQL Editor.
-- =============================================================

begin;

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

revoke all on function public.expire_review_orders_before_delete() from public, anon, authenticated;

drop trigger if exists expire_review_orders_before_delete on public.review_items;
create trigger expire_review_orders_before_delete
before delete on public.review_items
for each row execute function public.expire_review_orders_before_delete();

-- Pertahankan baris pesanan. Saat review dihapus, hanya review_id yang menjadi NULL.
alter table public.cashi_orders
  drop constraint if exists cashi_orders_review_id_fkey;
alter table public.cashi_orders
  add constraint cashi_orders_review_id_fkey
  foreign key (review_id)
  references public.review_items(id)
  on delete set null;

-- review_id boleh NULL untuk pesanan review historis setelah review dihapus.
-- Pesanan review baru tetap wajib memiliki review_id selama status PENDING.
alter table public.cashi_orders
  drop constraint if exists order_target_check;
alter table public.cashi_orders
  add constraint order_target_check check (
    (purpose = 'vip' and plan_id is not null and review_id is null)
    or
    (purpose = 'review_download' and plan_id is null
      and (review_id is not null or status <> 'PENDING'))
  );

commit;
