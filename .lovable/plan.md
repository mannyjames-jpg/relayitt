# Relay — Build Plan

A single-page task + delegation tracker for one personal assistant, with Lovable Cloud (Postgres + auth) and per-user Google Calendar sync.

## 1. Backend (Lovable Cloud)

**Enable Cloud**, then create schema via migration:

- `contacts` — `id, name (required, ≤100), role, phone, email, notes, user_id, created_at`
- `tasks` — all fields from spec including `source`, `status`, `assigned_to` (uuid FK → contacts, nullable), `assigned_to_name` (text fallback for free-typed names), `due_date`, `due_time`, `last_followup_at`, `calendar_event_id`, `user_id`, `created_at`, `updated_at`, `completed_at`
- `google_tokens` — `user_id, access_token, refresh_token, expires_at, scope` (stores per-user OAuth tokens; service-role access only)
- Enums: `task_source`, `task_status`
- Trigger: auto-set `updated_at`; auto-manage `completed_at` when status flips to/from Done
- DB constraint: `due_time IS NULL OR due_date IS NOT NULL`
- RLS: every table scoped to `auth.uid() = user_id`. Grants for `authenticated` + `service_role`. `google_tokens` readable only via service role.

## 2. Auth

- Email/password only, no public sign-up (I'll disable the register route — `/auth` is sign-in + forgot-password only).
- Persistent session (Supabase default).
- Protected app lives under `_authenticated/`; `/auth` and `/reset-password` are public.
- You create the single user manually in the Cloud → Users panel after build.

## 3. Routes

```
/                       → redirects to /dashboard if signed in, /auth otherwise
/auth                   → sign in + forgot password (public)
/reset-password         → set new password (public, handles recovery hash)
/_authenticated/
  dashboard             → the single scrollable main screen
  contacts              → contact list
  contacts/$id          → contact detail (inline-editable, task list)
  completed             → done-tasks history
/api/public/google/callback  → OAuth code exchange, stores tokens, redirects to /dashboard
```

Header on the dashboard has small icons (top-right) linking to Contacts, Completed, and Sign out.

## 4. Dashboard (single page)

Sticky Quick Capture bar at top:
- Text input + segmented control (From Boss / Delegated by Me / Personal Reminder, defaults to Personal Reminder but remembers last used within the session).
- If "Delegated by Me", inline "Assign to" combobox with contact autocomplete; unknown name → after task creation, small inline "Save [name] as a contact?" prompt.
- Enter creates task, clears input, re-focuses, brief check-flash. Empty title → shake + disabled Add.

Sections (each with count badge, hidden when empty except Today):
1. **Today / Overdue** — overdue at top with subtle amber left-border; today's timed tasks sorted by `due_time`, untimed after. Calm empty state.
2. **Waiting on Someone** — grouped by assignee name; per-row "waiting X days" from `last_followup_at ?? created_at`; ≥3 days = amber dot + label; "Nudge sent" button updates `last_followup_at` with animation. Section hidden if empty.
3. **Upcoming** — future dates grouped by day header. Hidden if empty.
4. **Someday** — no due date; collapsed by default, shows count.

**Task row**:
- Compact: checkbox, title, status pill, due date/time, assignee chip.
- Inline status dropdown on compact row.
- Tap row → expand in place: notes, status, reassign, date+time editor, delete.
- Check → optimistic mark Done with fade-slide-out (~500ms), then removed; inline "Task completed — Undo" toast for ~5s.
- Delete → same inline "Deleted — Undo" pattern, no confirm modal.
- Status color always paired with icon + text label (accessibility).

## 5. Contacts

- List: name, role, active-task count (live via query).
- Detail: contact fields (inline-edit + save), plus their tasks (active grouped above recently-completed).
- Add Contact: name required; encourage phone or email with a soft hint (not blocking).

## 6. Completed view

- Sorted by `completed_at` desc.
- Row shows title, source, assignee, completed timestamp, and Reopen button (sets status → Not Started, clears `completed_at`, deletes any calendar event).

## 7. Google Calendar sync (per-user OAuth)

**What I need from you** (I'll pause and prompt before writing the sync code):
1. Google Cloud project with **Google Calendar API** enabled.
2. OAuth 2.0 Web Client credentials.
3. Add authorized redirect URI: `https://project--<project-id>.lovable.app/api/public/google/callback` (I'll give you the exact URL).
4. Paste `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Cloud secrets.

**Flow**:
- Settings-style "Connect Google Calendar" button on the dashboard header area (small, unobtrusive). Redirects to Google consent (scope `calendar.events`, `access_type=offline`, `prompt=consent` to guarantee refresh token).
- `/api/public/google/callback` exchanges code, stores tokens in `google_tokens`.
- Server function `syncTaskToCalendar(taskId)` called on task create/update/delete/complete:
  - Skip when `due_date` set but `due_time` missing (date-only tasks don't sync).
  - Create event if none, update if `calendar_event_id` exists, delete on Done/clear/delete.
  - Refresh access token via refresh_token when expired.
- On failure: catch and stamp a `sync_failed` flag in local component state (small ⚠ icon on the row tooltip: "Calendar sync failed"). Non-blocking, no full-screen error.

## 8. Design

- Light `#FFFFFF` bg with `#F7F7F5` section separators; charcoal text `#1F2328`; muted `#6B7280`; accent amber `#F77E2D` (Add button, Nudge sent, 3+ day waiting flag ONLY).
- System sans stack (`-apple-system, ui-sans-serif, ...`) for iOS-native feel.
- Mobile-first, 44px min touch targets, generous spacing.
- No dark mode toggle, no illustrations, no marketing copy.
- shadcn/ui primitives (Button, Input, Popover, Command for autocomplete, Collapsible for Someday).

## 9. Explicitly not in v1

Multi-user, itineraries, expenses, push notifications, analytics, dark mode. Google Calendar's all-day event path is skipped for date-only tasks (per your preference).

## Technical notes

- Server fns in `src/lib/tasks.functions.ts`, `contacts.functions.ts`, `calendar.functions.ts`; all use `requireSupabaseAuth`.
- `supabaseAdmin` (for `google_tokens` writes/reads) imported dynamically inside handlers only.
- TanStack Query for cache; mutations invalidate `['tasks']`, `['contacts']`, `['completed']` as appropriate.
- Optimistic updates for check-off, nudge, status change.
- Zod validation on every server fn input.

## Build order

1. Enable Cloud + migration + RLS
2. Auth pages (`/auth`, `/reset-password`, `_authenticated` gate)
3. Server fns for tasks + contacts
4. Dashboard with Quick Capture + all four sections + row interactions
5. Contacts + Completed views
6. **Pause** — request Google OAuth credentials from you
7. Google Calendar OAuth + sync
8. Polish, empty states, accessibility pass
