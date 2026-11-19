-- BoxCellink VIP Group payment/profile repair
-- Run this migration once in Supabase SQL Editor after the existing VIP Group migrations.
begin;

-- Keep the order snapshot columns available for checkout and settlement recovery.
alter table public.cashi_orders
  add column if not exists vip_group_id uuid references public.vip_groups(id) on delete set null,
  add column if not exists vip_group_invite_url text;

alter table public.vip_group_entitlements
  add column if not exists invite_expires_at timestamptz;

create index if not exists cashi_orders_vip_group_user_history_idx
  on public.cashi_orders(user_id, settled_at desc)
  where purpose='vip_group' and status='SETTLED';

create table if not exists public.vip_group_secrets(
  group_id uuid primary key references public.vip_groups(id) on delete cascade,
  telegram_url text not null,
  updated_at timestamptz not null default now()
);

-- Preserve links saved in the legacy column when a secret row is missing.
insert into public.vip_group_secrets(group_id,telegram_url)
select id,telegram_url
from public.vip_groups
where telegram_url is not null and btrim(telegram_url)<>''
on conflict(group_id) do nothing;

alter table public.vip_group_secrets enable row level security;
drop policy if exists "admin manage vip group secrets" on public.vip_group_secrets;
create policy "admin manage vip group secrets"
  on public.vip_group_secrets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.vip_group_secrets from anon,authenticated;
grant select,insert,update,delete on public.vip_group_secrets to authenticated;

-- Existing entitlements get a 24-hour window from their original purchase time.
update public.vip_group_entitlements
set invite_expires_at=coalesce(invite_expires_at,created_at+interval '24 hours')
where invite_expires_at is null;

create or replace function public.set_vip_group_invite_expiry()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='INSERT' then
    new.invite_expires_at:=coalesce(new.created_at,now())+interval '24 hours';
  elsif new.order_id is distinct from old.order_id then
    new.created_at:=now();
    new.invite_expires_at:=now()+interval '24 hours';
  elsif new.invite_expires_at is null then
    new.invite_expires_at:=coalesce(new.created_at,now())+interval '24 hours';
  end if;
  return new;
end $$;

drop trigger if exists vip_group_invite_expiry_24h on public.vip_group_entitlements;
create trigger vip_group_invite_expiry_24h
before insert or update of order_id,created_at,invite_expires_at
on public.vip_group_entitlements
for each row execute function public.set_vip_group_invite_expiry();

-- Service-side idempotent grant. It verifies the order is genuinely settled and
-- prefers the current admin-managed invite link, then the order snapshot.
create or replace function public.ensure_vip_group_entitlement_for_order(p_order_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  o public.cashi_orders%rowtype;
  v_url text;
  v_name text;
begin
  select * into o
  from public.cashi_orders
  where order_id=p_order_id
  for update;

  if not found then return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND'); end if;
  if o.status<>'SETTLED' or o.purpose<>'vip_group' or o.vip_group_id is null then
    return jsonb_build_object('ok',false,'reason','ORDER_NOT_SETTLED_VIP_GROUP');
  end if;

  select coalesce(nullif(btrim(s.telegram_url),''),nullif(btrim(o.vip_group_invite_url),''),nullif(btrim(e.telegram_url),'')),
         g.name
    into v_url,v_name
  from public.vip_groups g
  left join public.vip_group_secrets s on s.group_id=g.id
  left join public.vip_group_entitlements e on e.user_id=o.user_id and e.group_id=o.vip_group_id
  where g.id=o.vip_group_id;

  if v_url is null or v_url !~ '^https://(t\.me|telegram\.me)/' then
    return jsonb_build_object('ok',false,'reason','GROUP_INVITE_NOT_CONFIGURED');
  end if;

  insert into public.vip_group_entitlements(user_id,group_id,order_id,telegram_url,created_at,invite_expires_at)
  values(o.user_id,o.vip_group_id,o.order_id,v_url,coalesce(o.settled_at,now()),coalesce(o.settled_at,now())+interval '24 hours')
  on conflict(user_id,group_id) do update
    set order_id=excluded.order_id,
        telegram_url=excluded.telegram_url,
        created_at=case when public.vip_group_entitlements.order_id is distinct from excluded.order_id
                        then excluded.created_at else public.vip_group_entitlements.created_at end,
        invite_expires_at=case when public.vip_group_entitlements.order_id is distinct from excluded.order_id
                               then excluded.invite_expires_at else coalesce(public.vip_group_entitlements.invite_expires_at,excluded.invite_expires_at) end
    where coalesce(
      (select coalesce(c.settled_at,c.created_at) from public.cashi_orders c
       where c.order_id=public.vip_group_entitlements.order_id),
      '-infinity'::timestamptz
    ) <= coalesce(o.settled_at,o.created_at);

  return jsonb_build_object('ok',true,'group_id',o.vip_group_id,'group_name',v_name,'invite_expires_at',coalesce(o.settled_at,now())+interval '24 hours');
end $$;

revoke all on function public.ensure_vip_group_entitlement_for_order(text) from public,anon,authenticated;
grant execute on function public.ensure_vip_group_entitlement_for_order(text) to service_role;

-- Member-side repair for old paid orders. Only the authenticated member's orders
-- are considered; service-only grant logic performs the actual upsert.
create or replace function public.sync_my_vip_group_entitlements()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  r record;
  v_result jsonb;
  v_count integer:=0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED');
  end if;

  for r in
    select distinct on (vip_group_id) order_id
    from public.cashi_orders
    where user_id=auth.uid() and purpose='vip_group' and status='SETTLED'
    order by vip_group_id,coalesce(settled_at,created_at) desc
  loop
    v_result:=public.ensure_vip_group_entitlement_for_order(r.order_id);
    if coalesce((v_result->>'ok')::boolean,false) then
      v_count:=v_count+1;
    end if;
  end loop;

  return jsonb_build_object('ok',true,'synced',v_count);
end $$;
revoke all on function public.sync_my_vip_group_entitlements() from public,anon;
grant execute on function public.sync_my_vip_group_entitlements() to authenticated;

-- Return only the current invite URL for 24 hours, while keeping purchase history.
create or replace function public.get_my_vip_group_entitlements()
returns table(
  entitlement_id uuid,
  group_id uuid,
  group_name text,
  purchased_at timestamptz,
  invite_expires_at timestamptz,
  telegram_url text
)
language sql stable security definer set search_path=public as $$
  select e.id,e.group_id,g.name,e.created_at,e.invite_expires_at,
    case when e.invite_expires_at>now()
      then coalesce(nullif(s.telegram_url,''),e.telegram_url)
      else null end
  from public.vip_group_entitlements e
  join public.vip_groups g on g.id=e.group_id
  left join public.vip_group_secrets s on s.group_id=e.group_id
  where e.user_id=auth.uid()
  order by e.created_at desc;
$$;
revoke all on function public.get_my_vip_group_entitlements() from public,anon;
grant execute on function public.get_my_vip_group_entitlements() to authenticated;

commit;
