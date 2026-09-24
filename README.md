# Relay Assistant

Build a personal assistant task and delegation management app called "Relay" for a single 

user (a professional personal assistant managing tasks for one principal/employer). Use 

Lovable Cloud for the backend — database, authentication, and edge functions if needed.

## CORE PURPOSE

This app replaces sticky notes, a generic Notes app, and manually re-typing reminders into 

the iPhone Calendar. The user receives tasks verbally from her boss, delegates some to other 

people (vendors, drivers, other staff), and needs to track what she's waiting on from those 

people without it silently falling through the cracks. The single measure of success: she can 

capture anything in under 10 seconds, and nothing delegated goes more than a few days without 

her noticing.

## USERS & AUTH

- Single user for now, using Lovable Cloud email/password authentication.

- No public sign-up page — I will create the one account manually after the build.

- After login, go straight to the main dashboard — no onboarding flow, tutorial, or welcome 

  screen.

- Include a basic "forgot password" flow since Lovable Cloud auth supports it by default.

- Session should stay logged in on the same device/browser (persistent session) so she isn't 

  re-entering a password throughout the day.

## DATA MODEL

Create these tables in Lovable Cloud:

1. "tasks" table:

   - id (uuid, auto)

   - title (text, required, max 200 characters)

   - notes (text, optional, free-form, no character limit)

   - source (enum: "From Boss", "Delegated by Me", "Personal Reminder" — required, defaults 

     to "Personal Reminder")

   - status (enum: "Not Started", "In Progress", "Waiting on Someone", "Done" — required, 

     defaults to "Not Started")

   - assigned_to (text or foreign key reference to contacts.id — optional; only shown/editable 

     in the UI when source = "Delegated by Me" or status = "Waiting on Someone")

   - due_date (date, optional)

   - due_time (time, optional — only usable if due_date is also set; a time with no date 

     should not be allowed by the UI)

   - created_at (timestamp, auto-set on creation)

   - updated_at (timestamp, auto-updated on any edit)

   - completed_at (timestamp, auto-set the moment status changes to "Done"; auto-cleared to 

     null if status is changed away from "Done")

   - last_followup_at (timestamp, optional, nullable — only set when the "Nudge sent" action 

     is used)

   - calendar_event_id (text, optional, nullable — stores the synced Google Calendar event ID 

     so it can be updated/deleted later instead of duplicated)

2. "contacts" table:

   - id (uuid, auto)

   - name (text, required, max 100 characters)

   - role (text, optional, e.g. "Driver", "Vendor", "Housekeeper")

   - phone (text, optional)

   - email (text, optional)

   - notes (text, optional)

   - created_at (timestamp, auto)

Relationship: "tasks.assigned_to" should link to "contacts" when possible, but the UI must 

also allow typing a brand-new name directly into the assign field. If that name doesn't match 

an existing contact, prompt with a small inline option: "Save [name] as a contact?" (yes/no) 

rather than silently creating a duplicate or silently discarding the name.

## VALIDATION RULES

- "title" is the only required field to create a task — everything else can be added later.

- Prevent creating a task with an empty/whitespace-only title; quick capture bar should 

  visually shake or briefly disable the Add button rather than showing a jarring error popup.

- due_time cannot be set without due_date (grey out or hide the time field until a date is 

  chosen).

- Contact "name" is required to save a contact; phone/email are optional but at least one 

  contact method should be encouraged (not strictly required).

## MAIN SCREEN — SINGLE DASHBOARD (no tab navigation for core features)

Everything below lives on ONE scrollable page. Do not split Today/Waiting/Upcoming into 

separate tabs or routes — she should see her whole day by scrolling, not clicking between 

views.

### 1. Quick Capture Bar (fixed/sticky at top, always visible while scrolling)

- Single-line text input, placeholder text: "Add a task..."

- Inline "Source" selector immediately next to or below the input — a compact 3-option 

  segmented control (From Boss / Delegated by Me / Personal Reminder), defaulting to 

  "Personal Reminder" each time the bar is used.

- If "Delegated by Me" is selected, reveal a small optional "Assign to" field inline (not a 

  popup) with autocomplete against existing contacts.

- Pressing Enter (or tapping an Add button) creates the task immediately, clears the input, 

  keeps focus in the input so she can immediately type the next task without re-tapping.

- No confirmation dialog, no toast that blocks further typing — at most a subtle, brief 

  (under 1 second) visual confirmation like a checkmark flash.

- The Source selector should reset to "Personal Reminder" after each submission, since most 

  entries will be that type — don't make her re-select it every time only if she's adding 

  several of the same type in a row (i.e. remember the last-used source for the current 

  session, not permanently).

### 2. Today / Overdue Section

- Header: "Today" with a small count badge (e.g. "Today (4)")

- Tasks due today appear first in due_time order (tasks with no due_time appear after timed 

  ones); overdue tasks (due_date in the past, status not Done) appear at the very top of this 

  section, each with a small red/orange left-border or dot — not a full red row background, 

  keep it subtle.

- If there are zero tasks today and none overdue, show a short, calm empty state like "Nothing 

  due today" — not an illustration, just quiet text.

### 3. Waiting on Someone (highest visual priority section)

- Header: "Waiting on Someone" with count badge.

- Group tasks by the person in assigned_to, with the person's name as a sub-header 

  (e.g. "Mike (Driver)") — if unassigned, group under "Unassigned."

- Each task row shows a small "waiting X days" label calculated from last_followup_at if set, 

  otherwise from created_at.

- Any task waiting 3+ days gets a visually distinct badge/dot (amber or red — pick one 

  consistent color, don't use both) so it stands out at a glance while scrolling.

- Each row has a "Nudge sent" button — tapping it updates last_followup_at to now and 

  visually resets the "waiting X days" counter with a brief confirmation animation, no popup 

  or confirmation dialog required.

- If there's nothing being waited on, this entire section should collapse/hide itself rather 

  than showing an empty state — no need to take up space when it's not relevant.

### 4. Upcoming

- Header: "Upcoming" with count badge.

- Tasks with a future due_date (not today), sorted chronologically, grouped by date with 

  clear date sub-headers (e.g. "Thursday, July 16").

- If none, hide the section entirely (same as Waiting on Someone).

### 5. No Due Date / Someday

- Header: "Someday" — collapsed/closed by default, with a simple tap to expand and see the 

  full list.

- Shows a count even while collapsed (e.g. "Someday (7)") so she knows it exists without it 

  cluttering the view.

### Task Row Behavior (applies across all sections)

- Compact by default: shows title, a small status indicator/icon, due date/time if set, and 

  assigned person if set.

- Tapping the row (not a specific button) expands it in place to reveal notes, full 

  status-change control, reassign field, and due date/time editor — no navigation to a 

  separate page or modal, everything happens inline.

- A quick status-change control should be reachable without fully expanding the row (e.g. a 

  small dropdown or icon-button directly on the compact row).

- A checkbox or check-icon on the far left/right of the row marks it Done directly, with a 

  brief, subtle completion animation (e.g. a fade-and-slide-out after a half-second delay so 

  she can see it registered before it disappears from the active list).

- Support swipe-to-complete on mobile if Lovable's component library supports it easily; if 

  not trivial, skip it rather than building something fragile.

- Marking a task Done should immediately remove it from whatever section it was in and it 

  should appear in the Completed view instead.

## CONTACTS VIEW (secondary screen)

- Reachable via a small icon (e.g. a people/contacts icon) in a corner of the main screen — 

  not a primary nav tab, since it's used far less often than the main dashboard.

- List of all contacts, each showing name, role, and a live count of their currently active 

  (non-Done) tasks.

- Tapping a contact shows their full task list (active and recently completed) plus their 

  contact details, editable inline.

- Simple "Add Contact" button with the name/role/phone/email/notes fields described above.

## CALENDAR SYNC

- Google Calendar integration via Lovable Cloud's external service connection — prompt me to 

  authorize this when you reach this part of the build, since I will need to grant access to 

  the correct Google account.

- When a task is created or edited with both due_date and due_time set, create or update a 

  corresponding Google Calendar event, storing the returned event ID in calendar_event_id.

- If due_date/due_time are cleared, or the task is marked Done, or the task is deleted, remove 

  the corresponding calendar event rather than leaving orphaned events behind.

- If a task has a due_date but no due_time, do not create a timed calendar event — either skip 

  calendar sync for that task or create it as an all-day event (prefer skipping sync entirely 

  for date-only tasks, since the calendar is mainly useful for time-specific commitments).

- Clearly tell me if any part of this isn't feasible in the first build pass, and specify 

  exactly what additional setup, API access, or approval you need from me to complete it.

## COMPLETED VIEW (secondary screen)

- Reachable via a small link/icon, not a primary tab.

- Lists Done tasks sorted by completed_at, most recent first.

- Each entry shows title, source, who it was assigned to (if applicable), and when it was 

  completed.

- Include a simple way to "reopen" a completed task (sets status back to "Not Started" and 

  clears completed_at) in case something was marked done by mistake.

## EMPTY STATES & EDGE CASES

- First-ever login with zero tasks: show the quick capture bar prominently with a single quiet 

  line of text like "Add your first task above" — no illustrations or multi-step tutorials.

- Deleting a task: require a lightweight confirmation (not a full modal, a small inline "Undo" 

  option after deletion is preferable to a "Are you sure?" popup) since accidental taps should 

  be easily reversible.

- If Google Calendar sync fails (auth expired, API error), show a small, non-blocking 

  indicator on the affected task (not a full-screen error) so she knows that specific item 

  didn't sync, without disrupting her ability to keep using the rest of the app.

## DESIGN DIRECTION

- Clean, calm, and fast — built for quick glances throughout a busy day, not leisurely 

  browsing.

- Light background (white or very light grey), high text contrast, minimal visual noise — 

  avoid heavy gradients, drop shadows, or busy patterns.

- One accent color used sparingly and consistently — a warm amber/orange around #F77E2D — 

  reserved for primary actions (Add button, Nudge sent) and the "waiting 3+ days" flag. Don't 

  use it decoratively elsewhere.

- Dark charcoal text (not pure black) on the light background for readability without harshness.

- Mobile-first: this is used primarily on an iPhone during a busy workday. Touch targets 

  should be comfortably large (minimum ~44px tap height), spacing generous enough to avoid 

  mis-taps, and the layout should work perfectly on a small screen before desktop is considered 

  at all.

- Typography should be simple and highly legible — a clean sans-serif, no decorative or 

  script fonts anywhere in this app.

- No onboarding screens, tutorials, empty-state illustrations, or marketing-style copy 

  anywhere in the app — every screen should get straight to function.

## ACCESSIBILITY BASICS

- Sufficient color contrast for all text against its background.

- All interactive elements (buttons, checkboxes, inputs) reachable and operable via keyboard, 

  not just touch/click, in case this is ever used on desktop.

- Status changes and completions should not rely on color alone to communicate meaning — pair 

  color indicators with an icon or label as well.

## WHAT NOT TO BUILD (v1 scope control — do not add these even if they seem easy)

- No multi-user team features, shared accounts, or permission levels beyond the single login.

- No travel itinerary builder, preference/gift tracking, or expense tracking — this app is 

  intentionally scoped to task capture, delegation tracking, and calendar sync only.

- No push notifications unless Lovable Cloud makes this genuinely trivial to add — if included, 

  keep it to a single daily digest notification listing overdue items and anything waiting 3+ 

  days, and nothing more elaborate than that in v1.

- No analytics dashboards, charts, or productivity statistics — this is a working tool, not a 

  tracking/reporting product.

- No dark mode toggle in v1 — one clean light theme only, to keep the first build focused.

Before generating the full build, please confirm Lovable Cloud is set up for the database and 

authentication, and ask me any clarifying questions if anything above is ambiguous rather than 

guessing and building it a different way.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://relayitt.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c67d0487-2e2f-49c4-bbd1-2719544a6e09).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
