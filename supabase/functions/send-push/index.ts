import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Called only from a Postgres trigger via pg_net (see
// supabase/migrations/0004_push_notification_triggers.sql), never directly
// by app clients, so auth is a shared secret instead of a user JWT.
// ponytail: hardcoded shared secret, no secrets-manager available at deploy
// time. Upgrade path: move to Supabase Vault + an edge function secret.
const WEBHOOK_SECRET = "6d8bd667d3689cc2a586341e1c15335cb8b2c19a4a36e0da";

Deno.serve(async (req: Request) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { group_id, title, body, exclude_user_id } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", group_id)
    .neq("user_id", exclude_user_id);

  const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (userIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token")
    .in("user_id", userIds);

  const messages = (tokens ?? []).map((t: { token: string }) => ({
    to: t.token,
    title,
    body,
    sound: "default",
  }));

  if (messages.length > 0) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
  }

  return new Response(JSON.stringify({ sent: messages.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
