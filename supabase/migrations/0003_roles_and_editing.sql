-- Adds admin role, group settings (theme_color), edit/delete permissions,
-- and ownership transfer.

alter table public.group_members drop constraint if exists group_members_role_check;
alter table public.group_members add constraint group_members_role_check check (role in ('owner', 'admin', 'member'));

alter table public.groups add column if not exists theme_color text not null default '#4F46E5';
alter table public.messages add column if not exists edited_at timestamptz;

create function public.is_group_admin(target_group uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create function public.is_group_owner(target_group uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = auth.uid() and role = 'owner'
  );
$$;

revoke execute on function public.is_group_admin(uuid) from public, anon;
grant execute on function public.is_group_admin(uuid) to authenticated;
revoke execute on function public.is_group_owner(uuid) from public, anon;
grant execute on function public.is_group_owner(uuid) to authenticated;

-- ---------- groups: rename + theme color (owner/admin only) ----------
create policy "groups updatable by admin" on public.groups
  for update using (public.is_group_admin(id)) with check (public.is_group_admin(id));

-- ---------- group_members: role changes + removal ----------
-- plain UPDATE can only toggle member<->admin; promoting to 'owner' must go
-- through transfer_group_ownership so the previous owner is demoted atomically.
create policy "group_members role updatable by owner" on public.group_members
  for update using (public.is_group_owner(group_id))
  with check (public.is_group_owner(group_id) and role in ('member', 'admin'));

create policy "group_members removable by admin" on public.group_members
  for delete using (public.is_group_admin(group_id) and role <> 'owner');

create function public.transfer_group_ownership(target_group uuid, new_owner uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'only the current owner can transfer ownership';
  end if;
  if not exists (
    select 1 from public.group_members where group_id = target_group and user_id = new_owner
  ) then
    raise exception 'target user is not a member of this group';
  end if;

  update public.group_members set role = 'admin' where group_id = target_group and user_id = auth.uid();
  update public.group_members set role = 'owner' where group_id = target_group and user_id = new_owner;
  update public.groups set created_by = new_owner where id = target_group;
end;
$$;

revoke execute on function public.transfer_group_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated;

-- ---------- events: delete extended to owner/admin (edit stays author-only) ----------
drop policy if exists "events deletable by creator" on public.events;
create policy "events deletable by creator or admin" on public.events
  for delete using (created_by = auth.uid() or public.is_group_admin(group_id));

-- ---------- messages: author can edit own; author/admin can delete ----------
create policy "messages editable by author" on public.messages
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "messages deletable by author or admin" on public.messages
  for delete using (user_id = auth.uid() or public.is_group_admin(group_id));

-- ---------- notes: author can edit own; author/admin can delete ----------
drop policy if exists "notes updatable by group members" on public.notes;
create policy "notes editable by author" on public.notes
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "notes deletable by author or admin" on public.notes
  for delete using (created_by = auth.uid() or public.is_group_admin(group_id));

-- ---------- polls: delete-only (no edit — see product decision) ----------
create policy "polls deletable by creator or admin" on public.polls
  for delete using (created_by = auth.uid() or public.is_group_admin(group_id));
