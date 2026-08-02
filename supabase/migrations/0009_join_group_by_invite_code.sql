-- Invite-code join was broken: "groups readable by members" RLS only lets
-- existing members/creator SELECT a group, so a non-member looking up a
-- group by invite code always got zero rows back, even for valid codes.
-- Fix: a security-definer RPC that looks up the group by code and inserts
-- the membership in one server-side step, without opening groups SELECT
-- to everyone.
create or replace function public.join_group_by_invite_code(code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.groups;
begin
  select * into target from public.groups where invite_code = lower(trim(code));
  if target.id is null then
    raise exception 'Invite code not found';
  end if;

  insert into public.group_members (group_id, user_id)
  values (target.id, auth.uid())
  on conflict (group_id, user_id) do nothing;

  return target;
end;
$$;

grant execute on function public.join_group_by_invite_code(text) to authenticated;
