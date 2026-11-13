-- Referral cash reward: Rp1.000 per successful new account attributed to a referrer.
-- Run once in Supabase SQL Editor after wallet_ledger and profiles are installed.
begin;

create unique index if not exists wallet_ledger_referral_reward_once
  on public.wallet_ledger(user_id, reference_id)
  where entry_type = 'referral_reward';

create or replace function public.credit_referral_deposit_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
begin
  if new.referred_by is null or new.referred_by = new.id then
    return new;
  end if;

  insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description)
  values(new.referred_by,'deposit',1000,'referral_reward',new.id::text,'Hadiah referral Rp1.000')
  on conflict (user_id,reference_id) where entry_type = 'referral_reward' do nothing
  returning id into v_entry_id;

  if v_entry_id is not null then
    update public.profiles
      set deposit_balance = coalesce(deposit_balance,0) + 1000
      where id = new.referred_by;
    insert into public.boxcellink_notifications(user_id,title,body,kind,href,is_read,is_admin_managed)
    values(new.referred_by,'Hadiah referral masuk','Kamu mendapatkan saldo deposit Rp1.000 dari referral baru. Saldo dapat digunakan untuk membeli VIP dan Media Telegram.','referral','/wallet.html',false,false);
  end if;
  return new;
end;
$$;

drop trigger if exists after_referral_deposit_reward on public.profiles;
create trigger after_referral_deposit_reward
after insert on public.profiles
for each row execute function public.credit_referral_deposit_reward();

-- Backfill referred accounts that already exist before this migration, exactly once.
with credited as (
  insert into public.wallet_ledger(user_id,wallet_type,amount,entry_type,reference_id,description)
  select p.referred_by,'deposit',1000,'referral_reward',p.id::text,'Hadiah referral Rp1.000'
  from public.profiles p
  where p.referred_by is not null and p.referred_by <> p.id
  on conflict (user_id,reference_id) where entry_type = 'referral_reward' do nothing
  returning user_id,amount
), totals as (
  select user_id,sum(amount)::bigint as amount from credited group by user_id
)
update public.profiles p
set deposit_balance = coalesce(p.deposit_balance,0) + totals.amount
from totals
where p.id = totals.user_id;

commit;
