# Relay

Relay: a calm task and delegation tracker. Capture what's on your plate, hand it off, and keep track of who you're waiting on.

## Live demo

A hosted demo is available at https://relayitt.lovable.app. A demo login is provided with the submission.

## What it does

- Quick capture: type a task naturally (including shortcuts like "tomorrow" or "#finance") or capture it by voice.
- Tasks grouped by Overdue / Due Today / Waiting on Someone / Coming Up / Whenever on a single scrolling dashboard.
- Delegation to contacts, with "waiting X days" tracking and a one-tap "nudge sent" action.
- Recurring tasks: daily, weekly, and monthly.
- Completed history with one-tap reopen.
- Contacts list showing each person's active tasks.
- Optional Google Calendar sync for tasks with a date and time.

## Tech stack

| Layer | Technology |
| --- | --- |
| App builder | Lovable (AI app builder, used for the whole build) |
| Framework | TanStack Start + React + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase Postgres, with row-level security |
| Auth | Supabase Auth (email and password) |
| Validation | zod |
| Data fetching | TanStack Query |

## Architecture

The React screens talk to a REST API served under `/api/public/v1`. Each endpoint authenticates the caller with the Supabase access token sent as a Bearer token, validates input with zod, and then runs shared service functions (`src/lib/tasks.service.server.ts`, `src/lib/contacts.service.server.ts`) that query Postgres as the signed-in user, so row-level security applies to every query.

Those same service modules are also used by the app's original server functions, so the screens and the REST API share one set of business logic.

## REST API

| Method | Path | What it does | Success status |
| --- | --- | --- | --- |
| GET | `/api/public/v1/health` | Health check (no auth) | 200 |
| GET | `/api/public/v1/tasks` | List tasks, optional `?status=` and `?completed=true` | 200 |
| POST | `/api/public/v1/tasks` | Create a task | 201 |
| GET | `/api/public/v1/tasks/:id` | Get one task | 200 |
| PATCH | `/api/public/v1/tasks/:id` | Update a task | 200 |
| DELETE | `/api/public/v1/tasks/:id` | Delete a task, optional `?scope=series` for recurring | 204 |
| POST | `/api/public/v1/tasks/:id/nudge` | Record that a follow-up was sent | 200 |
| GET | `/api/public/v1/contacts` | List contacts | 200 |
| POST | `/api/public/v1/contacts` | Create a contact | 201 |
| GET | `/api/public/v1/contacts/:id` | Get one contact, including their tasks | 200 |
| PATCH | `/api/public/v1/contacts/:id` | Update a contact | 200 |
| DELETE | `/api/public/v1/contacts/:id` | Delete a contact | 204 |

All endpoints except `/health` require an `Authorization: Bearer <ACCESS_TOKEN>` header, where `<ACCESS_TOKEN>` is a Supabase access token from signing in.

Successful responses are wrapped in a `{"data": ...}` envelope. Errors use `{"error": {"code", "message"}}` with these status codes:

| Status | Codes |
| --- | --- |
| 400 | `validation_failed`, `bad_json` |
| 401 | `unauthorized` |
| 404 | `not_found` |
| 500 | `internal_error` |

## Example request

List tasks:

```sh
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  https://relayitt.lovable.app/api/public/v1/tasks
```

Create a task:

```sh
curl -X POST \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Pick up dry cleaning", "source": "Personal Reminder"}' \
  https://relayitt.lovable.app/api/public/v1/tasks
```

Example response:

```json
{
  "data": {
    "id": "0f0d0ba1-6c1d-4f6e-9a30-1d8b6e9c2f41",
    "title": "Pick up dry cleaning",
    "source": "Personal Reminder",
    "status": "Not Started",
    "due_date": null,
    "due_time": null
  }
}
```

## Data model

- `tasks` — the core table: title, notes, source, status, category, priority, assignee, due date/time, and recurrence fields.
- `contacts` — the people tasks are delegated to: name, role, phone, email, notes.
- `profiles` — per-user settings attached to the signed-in account.
- `task_steps` — a newest-first step log attached to tasks.

Every row is scoped to its owner and protected by row-level security.

## Running it locally

```sh
git clone <repository-url>
cd relayitt
bun install        # or npm install
```

The project includes both a bun.lock and a package-lock.json, so either bun or npm works.

Copy the environment variables the project needs (names only):

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The server-side API routes read the first pair and the browser reads the second; each pair holds the same project URL and publishable key.

Then start the dev server:

```sh
bun run dev        # or npm run dev
```

## Project structure

```text
src/
  routes/                  # App screens (dashboard, contacts, completed, auth)
    api/public/v1/         # REST API endpoints
  components/              # UI components (task rows, quick capture, voice capture)
  lib/                     # Shared logic: services, schemas, API client, parsing
  integrations/supabase/   # Generated Supabase clients
```

## How it was built

Relay was built with Lovable prompts: it started as a prompt-driven build, went through two visual redesigns, then gained recurring tasks, voice capture, and Google Calendar sync. Later passes added the REST API layer and proper loading, empty, and error states across the screens.

## Known limitations / next steps

- The applicant screening tool is a separate side feature, not part of the core task flow.
- Google Calendar sync needs its own credentials to be configured before it works.
- There are no automated tests yet.
- The iOS app shares this backend.
