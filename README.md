# Trekly

A group calendar / chat / polls / notes / expenses app for planning trips and hangouts with friends — built for web, iOS, and Android from one codebase.

## About

Trekly is the shared home base for a trip or hangout: one group, one invite code, everyone's calendar/chat/polls/notes/expenses in the same place instead of scattered across texts and spreadsheets. Create a group, invite people with a code, and plan together.

## Stack

- **App**: [Expo](https://docs.expo.dev/) (React Native + Expo Router) — one codebase for web, iOS, Android
- **Backend**: [Supabase](https://supabase.com/) — Postgres, Auth (email/password + Google/Apple OAuth), Row Level Security, Realtime, Edge Functions
- **Language**: TypeScript

## Features

- **Auth**: email/password and Google/Apple sign-in
- **Groups**: create or join via invite code; roles are `owner` → `admin` → `member`, with the owner able to transfer ownership, promote admins, and delete the group
- **Calendar**: month/week/day views, click-to-create on empty slots, all-day and recurring events, RSVP with live per-status counts (going/maybe/no), location with a tap-to-open-in-Maps link, `.ics` export (web download / native share sheet)
- **Chat**: realtime messages, edit/delete your own, admins can moderate
- **Polls**: multi-option voting with live results, question/option editing
- **Notes**: free text plus a checklist (packing lists, to-dos)
- **Expenses**: log or edit a cost, splits equally among current members, shows running balances (who owes / is owed) — balances still reconcile after someone leaves the group
- **Group settings**: rename, per-group accent color, member management, per-category push mute (chat/events/polls)
- **Push notifications**: new messages/events/polls notify the rest of the group, unless muted (native only — see [Push notifications](#push-notifications) below)

## Project structure

```
app/
  (auth)/              sign-in, sign-up
  groups/
    index.tsx           group list, create/join
    [groupId]/
      _layout.tsx        tab layout (Calendar/Chat/Polls/Notes/Expenses/Settings)
      index.tsx          calendar
      chat.tsx
      polls.tsx
      notes.tsx
      expenses.tsx
      settings.tsx
components/            shared UI (calendar grid, pickers, action sheet, ui/ primitives)
lib/                   supabase client, auth context, group/role context, theme, helpers
supabase/
  migrations/           schema history, in order
  functions/send-push/  edge function that sends push notifications
  reset_and_rebuild.sql  wipes + rebuilds the full schema from scratch (dev only)
```

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create a Supabase project**, then set up the schema. Easiest path: paste [`supabase/reset_and_rebuild.sql`](supabase/reset_and_rebuild.sql) into the Supabase SQL editor and run it once — it builds every table, RLS policy, and trigger from scratch. (The individual dated files in `supabase/migrations/` are the same history split out, for reference.)

3. **Environment variables** — copy the example and fill in your Supabase project's URL and anon/publishable key (Project Settings → API):
   ```
   cp .env.example .env
   ```

4. **Run it**
   ```
   npm run web       # web
   npm start          # then press i / a for iOS / Android
   ```

## OAuth (Google / Apple sign-in)

Enable providers in Supabase Dashboard → Authentication → Providers, and add your redirect URLs (app scheme + web origin) under Authentication → URL Configuration. See the provider setup docs linked from that page for the Google Cloud / Apple Developer side.

## Push notifications

Push requires a native build with an EAS project — it won't do anything in a web preview or unconfigured Expo Go. To enable:

1. `eas init` to create an EAS project (adds a project id to `app.json`).
2. Build/run on a real device.
3. The `send-push` edge function ([`supabase/functions/send-push`](supabase/functions/send-push)) is already deployed and wired to fire on new messages/events/polls via DB triggers — no extra setup needed once tokens are registering.

## Notes

- `theme_color` per group recolors that group's buttons/highlights throughout the app.
- RLS is enabled on every table; most access rules live in the migration files, not application code.
