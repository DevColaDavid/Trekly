-- Bug fix: the app UI lets a group admin open the edit form for another
-- member's event or note (canManage = author || isAdmin), but the UPDATE
-- policies were author-only. RLS silently drops the row from the UPDATE's
-- target set instead of erroring, so the admin's save looked like it worked
-- and did nothing. Delete was already admin-inclusive (see
-- 0003_roles_and_editing.sql); extend update the same way.

drop policy if exists "events updatable by creator" on public.events;
create policy "events updatable by creator or admin" on public.events
  for update using (created_by = auth.uid() or public.is_group_admin(group_id))
  with check (created_by = auth.uid() or public.is_group_admin(group_id));

drop policy if exists "notes editable by author" on public.notes;
create policy "notes editable by author or admin" on public.notes
  for update using (created_by = auth.uid() or public.is_group_admin(group_id))
  with check (created_by = auth.uid() or public.is_group_admin(group_id));

-- Feature: poll editing (previously delete-only). Editing options is
-- restricted to before any votes exist, enforced in the app; the DB just
-- needs write access for the question/options.
create policy "polls updatable by creator or admin" on public.polls
  for update using (created_by = auth.uid() or public.is_group_admin(group_id))
  with check (created_by = auth.uid() or public.is_group_admin(group_id));

-- editing can add new options, so insert needs the same author-or-admin
-- reach as the other poll_options policies below.
drop policy if exists "poll_options writable by poll creator" on public.poll_options;
create policy "poll_options writable by poll creator or admin" on public.poll_options
  for insert with check (exists (
    select 1 from public.polls p where p.id = poll_id and (p.created_by = auth.uid() or public.is_group_admin(p.group_id))
  ));

create policy "poll_options updatable by poll creator or admin" on public.poll_options
  for update using (exists (
    select 1 from public.polls p where p.id = poll_id and (p.created_by = auth.uid() or public.is_group_admin(p.group_id))
  )) with check (exists (
    select 1 from public.polls p where p.id = poll_id and (p.created_by = auth.uid() or public.is_group_admin(p.group_id))
  ));

create policy "poll_options deletable by poll creator or admin" on public.poll_options
  for delete using (exists (
    select 1 from public.polls p where p.id = poll_id and (p.created_by = auth.uid() or public.is_group_admin(p.group_id))
  ));
