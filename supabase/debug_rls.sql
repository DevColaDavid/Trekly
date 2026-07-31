-- RLS diagnostic. Run in Supabase SQL editor.
-- Replace the two UUIDs below with your actual user id and group id
-- (Table Editor > profiles / groups, or: select id, email from auth.users;)

-- 1. Does the membership row actually exist? (runs as postgres, bypasses RLS)
select * from public.group_members
where group_id = '<GROUP_ID>' and user_id = '<USER_ID>';

-- 2. Does is_group_member() see it, simulating the same session context
--    PostgREST uses for your app's requests?
select set_config('request.jwt.claims', json_build_object('sub', '<USER_ID>', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.is_group_member('<GROUP_ID>');
reset role;

-- 3. Sanity check: does auth.uid() resolve at all under that simulated context?
select set_config('request.jwt.claims', json_build_object('sub', '<USER_ID>', 'role', 'authenticated')::text, true);
set local role authenticated;
select auth.uid();
reset role;

-- 4. Confirm all expected insert policies exist (should list 4+ rows: events, polls, notes, messages)
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and cmd = 'INSERT'
order by tablename;
