-- BoxCellink: support username at signup.
-- Run once in Supabase SQL Editor after the Account Center migration
-- (the migration that adds public.profiles.username).

alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';

create or replace function public.sync_auth_user_username_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(btrim(coalesce(new.raw_user_meta_data->>'username', '')));
begin
  if v_username = '' then
    return new;
  end if;

  if v_username !~ '^[a-z0-9_.]{3,24}$' then
    raise exception 'USERNAME_INVALID';
  end if;

  update public.profiles
     set username = v_username
   where id = new.id;

  if not found then
    raise exception 'PROFILE_NOT_CREATED';
  end if;

  return new;
end;
$$;

revoke all on function public.sync_auth_user_username_to_profile() from public, anon, authenticated;

drop trigger if exists zz_auth_user_username_profile_sync on auth.users;
create trigger zz_auth_user_username_profile_sync
after insert on auth.users
for each row execute function public.sync_auth_user_username_to_profile();
