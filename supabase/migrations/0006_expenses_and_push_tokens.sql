-- Backfills migration history: `expenses`, `expense_splits`, and
-- `push_tokens` existed only in reset_and_rebuild.sql, not as a dated
-- migration, so anyone bootstrapping from the individual migration files
-- (as the README claims is equivalent) ended up missing expenses and push
-- entirely. `if not exists` / `drop policy if exists` throughout so this is
-- also safe to run against a project that already has these from
-- reset_and_rebuild.sql.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  paid_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.expense_splits (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  share numeric(10,2) not null check (share >= 0),
  primary key (expense_id, user_id)
);

alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;

drop policy if exists "expenses readable by group members" on public.expenses;
create policy "expenses readable by group members" on public.expenses
  for select using (public.is_group_member(group_id));
drop policy if exists "expenses writable by group members" on public.expenses;
create policy "expenses writable by group members" on public.expenses
  for insert with check (public.is_group_member(group_id) and paid_by = auth.uid());
drop policy if exists "expenses editable by payer or admin" on public.expenses;
create policy "expenses editable by payer or admin" on public.expenses
  for update using (paid_by = auth.uid() or public.is_group_admin(group_id))
  with check (paid_by = auth.uid() or public.is_group_admin(group_id));
drop policy if exists "expenses deletable by payer or admin" on public.expenses;
create policy "expenses deletable by payer or admin" on public.expenses
  for delete using (paid_by = auth.uid() or public.is_group_admin(group_id));

drop policy if exists "expense_splits readable by group members" on public.expense_splits;
create policy "expense_splits readable by group members" on public.expense_splits
  for select using (exists (
    select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)
  ));
drop policy if exists "expense_splits writable by expense payer" on public.expense_splits;
create policy "expense_splits writable by expense payer" on public.expense_splits
  for insert with check (exists (
    select 1 from public.expenses e where e.id = expense_id and e.paid_by = auth.uid()
  ));
-- editing an expense recomputes its splits (delete + reinsert), so admins
-- need write access here too, matching "expenses editable by payer or admin".
drop policy if exists "expense_splits writable by expense payer or admin" on public.expense_splits;
create policy "expense_splits writable by expense payer or admin" on public.expense_splits
  for insert with check (exists (
    select 1 from public.expenses e where e.id = expense_id and (e.paid_by = auth.uid() or public.is_group_admin(e.group_id))
  ));
drop policy if exists "expense_splits deletable by expense payer or admin" on public.expense_splits;
create policy "expense_splits deletable by expense payer or admin" on public.expense_splits
  for delete using (exists (
    select 1 from public.expenses e where e.id = expense_id and (e.paid_by = auth.uid() or public.is_group_admin(e.group_id))
  ));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'expenses'
  ) then
    alter publication supabase_realtime add table public.expenses;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'expense_splits'
  ) then
    alter publication supabase_realtime add table public.expense_splits;
  end if;
end $$;

create table if not exists public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens manageable by owner" on public.push_tokens;
create policy "push_tokens manageable by owner" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
