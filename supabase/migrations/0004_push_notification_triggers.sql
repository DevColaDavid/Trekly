-- Wires push notifications: fires the already-deployed `send-push` edge
-- function whenever a new message/event/poll is created, so other group
-- members get notified. Requires pg_net (enabled below).
--
-- ponytail: auth between this trigger and the edge function is a hardcoded
-- shared secret (no secrets-manager was available at deploy time). Upgrade
-- path: move both sides to Supabase Vault + an edge function secret.

create extension if not exists pg_net;

create function public.notify_group(target_group uuid, notif_title text, notif_body text, exclude_user uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://bkripfdrimleegazhvoh.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', '6d8bd667d3689cc2a586341e1c15335cb8b2c19a4a36e0da'),
    body := jsonb_build_object('group_id', target_group, 'title', notif_title, 'body', notif_body, 'exclude_user_id', exclude_user)
  );
end;
$$;

revoke execute on function public.notify_group(uuid, text, text, uuid) from public, anon, authenticated;

create function public.on_message_insert_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  sender_name text;
begin
  select display_name into sender_name from public.profiles where id = new.user_id;
  perform public.notify_group(new.group_id, coalesce(sender_name, 'Someone') || ' sent a message', left(new.body, 100), new.user_id);
  return new;
end;
$$;

create trigger on_message_insert_notify
  after insert on public.messages
  for each row execute function public.on_message_insert_notify();

create function public.on_event_insert_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notify_group(new.group_id, 'New event: ' || new.title, to_char(new.start_time, 'Mon DD, HH12:MI AM'), new.created_by);
  return new;
end;
$$;

create trigger on_event_insert_notify
  after insert on public.events
  for each row execute function public.on_event_insert_notify();

create function public.on_poll_insert_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notify_group(new.group_id, 'New poll', new.question, new.created_by);
  return new;
end;
$$;

create trigger on_poll_insert_notify
  after insert on public.polls
  for each row execute function public.on_poll_insert_notify();
