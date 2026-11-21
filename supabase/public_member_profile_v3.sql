-- Public profile RPC: expose only safe profile fields, plus current viewer friendship state.
create or replace function public.get_public_member_profile(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r jsonb; v_uid uuid:=auth.uid(); v_friend text:='none'; v_status text:='Basic';
begin
 select jsonb_build_object('id',p.id,'full_name',coalesce(p.full_name,''),'username',p.username,'bio',coalesce(p.bio,''),'social_links',coalesce(p.social_links,'{}'::jsonb),'vip_expires_at',p.vip_expires_at,'role',p.role,'membership_tier',to_jsonb(p)->>'membership_tier')
 into r from public.profiles p where p.id=p_user_id and nullif(trim(p.username),'') is not null;
 if r is null then return null; end if;
 if nullif(r->>'vip_expires_at','') is not null and (r->>'vip_expires_at')::timestamptz>now() then v_status:='VIP';
 elsif lower(coalesce(r->>'membership_tier','')) in ('publisher','published') or lower(coalesce(r->>'role','')) in ('publisher','published') then v_status:='Publisher'; end if;
 if v_uid is not null and v_uid<>p_user_id then
  select case when status='accepted' then 'friends' when sender_id=v_uid then 'sent' else 'received' end into v_friend
  from public.social_friend_requests where status in ('pending','accepted') and ((sender_id=v_uid and receiver_id=p_user_id) or (sender_id=p_user_id and receiver_id=v_uid)) limit 1;
 end if;
 return r||jsonb_build_object('status_label',v_status,'friend_state',coalesce(v_friend,'none'));
end $$;
revoke all on function public.get_public_member_profile(uuid) from public;
grant execute on function public.get_public_member_profile(uuid) to anon,authenticated;
