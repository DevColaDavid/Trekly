-- Fixes `.insert({...}).select()` on groups 403ing with "new row violates
-- row-level security policy for table groups".
--
-- Root cause: the groups SELECT policy only allowed is_group_member(id),
-- and membership is granted by the on_group_created AFTER INSERT trigger.
-- Postgres evaluates a RETURNING clause's row visibility before that
-- trigger's effects are visible within the same statement, so the insert
-- itself succeeded but RETURNING failed RLS. Letting the creator see their
-- own group directly (independent of the membership row) fixes it.
create policy "groups readable by creator" on public.groups
  for select using (created_by = auth.uid());
