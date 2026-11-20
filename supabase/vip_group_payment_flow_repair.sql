-- BoxCellink: reliable VIP Group payment -> entitlement -> account history flow.
-- Run once in Supabase SQL Editor after the existing VIP Group migrations.
begin;

-- Keep a fast, stable lookup for the member's settled VIP Group purchases.
create index if not exists cashi_orders_vip_group_history_lookup_idx
  on public.cashi_orders(user_id, settled_at desc, created_at desc)
  where purpose='vip_group' and status='SETTLED';

-- Idempotently publish access only for a genuinely settled VIP Group order.
-- Admin's current private invite URL takes precedence; the order snapshot is
-- retained as recovery if the admin secret row is temporarily unavailable.
create or replace function public.ensure_vip_group_entitlement_for_order(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  o public.cashi_orders%rowtype;
  v_url text;
  v_name text;
  v_expiry timestamptz;
begin
  select * into o
  from public.cashi_orders
  where order_id=p_order_id
  for update;

  if not found then
    return jsonb_build_object('ok',false,'reason','ORDER_NOT_FOUND');
  end if;
  if o.status<>'SETTLED' or o.purpose<>'vip_group' or o.user_id is null or o.vip_group_id is null then
    return jsonb_build_object('ok',false,'reason','ORDER_NOT_SETTLED_VIP_GROUP');
  end if;

  select coalesce(nullif(btrim(s.telegram_url),''),nullif(btrim(o.vip_group_invite_url),''),nullif(btrim(e.telegram_url),'')),g.name
    into v_url,v_name
  from public.vip_groups g
  left join public.vip_group_secrets s on s.group_id=g.id
  left join public.vip_group_entitlements e on e.user_id=o.user_id and e.group_id=o.vip_group_id
  where g.id=o.vip_group_id;

  if v_url is null or v_url !~ '^https://(t\.me|telegram\.me)/' then
    return jsonb_build_object('ok',false,'reason','GROUP_INVITE_NOT_CONFIGURED','group_id',o.vip_group_id);
  end if;

  v_expiry:=coalesce(o.settled_at,o.created_at,now())+interval '24 hours';
  insert into public.vip_group_entitlements(user_id,group_id,order_id,telegram_url,created_at,invite_expires_at)
  values(o.user_id,o.vip_group_id,o.order_id,v_url,coalesce(o.settled_at,o.created_at,now()),v_expiry)
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

  return jsonb_build_object('ok',true,'group_id',o.vip_group_id,'group_name',v_name,'invite_expires_at',v_expiry);
end;
$$;
revoke all on function public.ensure_vip_group_entitlement_for_order(text) from public,anon,authenticated;
grant execute on function public.ensure_vip_group_entitlement_for_order(text) to service_role;

-- Reconcile every settled order for the signed-in member. The entitlement
-- function is idempotent, so this is safe to run whenever Account is opened.
create or replace function public.sync_my_vip_group_entitlements()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
  v_result jsonb;
  v_count integer:=0;
  v_failed integer:=0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'reason','LOGIN_REQUIRED');
  end if;

  for r in
    select order_id
    from public.cashi_orders
    where user_id=auth.uid() and purpose='vip_group' and status='SETTLED'
    order by coalesce(settled_at,created_at) desc
  loop
    v_result:=public.ensure_vip_group_entitlement_for_order(r.order_id);
    if coalesce((v_result->>'ok')::boolean,false) then
      v_count:=v_count+1;
    else
      v_failed:=v_failed+1;
    end if;
  end loop;

  return jsonb_build_object('ok',true,'synced',v_count,'failed',v_failed);
end;
$$;
revoke all on function public.sync_my_vip_group_entitlements() from public,anon;
grant execute on function public.sync_my_vip_group_entitlements() to authenticated;

-- History remains visible to its purchaser. The invite URL is returned only
-- while the 24-hour access window is active, and uses the admin's latest URL.
create or replace function public.get_my_vip_group_entitlements()
returns table(
  entitlement_id uuid,
  group_id uuid,
  group_name text,
  purchased_at timestamptz,
  invite_expires_at timestamptz,
  telegram_url text
)
language sql
stable
security definer
set search_path=public
as $$
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
