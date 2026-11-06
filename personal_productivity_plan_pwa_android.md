# Personal Productivity Platform — Solo Build Plan (PWA + Android)
## Revised plan for a solo build, shipping the web PWA and Android app first

**Document status:** Revised blueprint, derived from `personal_productivity_platform_plan.md` (original kept unchanged for reference)  
**Owner:** Solo personal project, built by and primarily for its author  
**Product direction:** Standalone, privacy-conscious, offline-first personal productivity system  
**Target platforms:** **Now:** Web (installable PWA) and Android (React Native / Expo). **Later:** Windows desktop (Tauri) and iOS, once the first two are stable in daily use  
**Stack:** Vite + React + Ant Design PWA (folder layout modelled on hub--starter, no code from it), React Native + Expo, NestJS modular monolith, PostgreSQL + Prisma, TypeScript monorepo (npm workspaces)

---

## 1. Why this exists

Switching between separate apps for notes, tasks, calendar, and reminders costs time and attention. This project replaces them with one workspace where those things are connected: a note can become a task, a task can be scheduled, a project groups its notes and tasks, and one notification centre surfaces the next useful action.

The author is the first and primary user. That shapes every decision in this plan:

- **Success means retiring other apps.** A module is "done" when the app it replaces can be uninstalled.
- **Build order follows daily use.** Modules that replace the most-opened apps come first.
- **Dogfood early.** A rough version should be in daily personal use as soon as capture and tasks work, long before every module exists.
- **Solo bandwidth is the main constraint.** Prefer the simplest design that meets a requirement. Defer anything that only matters for other users (team features, public sign-up, billing).

### What changed from the original plan

| Area | Original | This plan |
|---|---|---|
| Platforms | Web, Windows, Android, iOS together | PWA + Android first; Windows and iOS in a later phase |
| Web framework | Next.js | Vite + React + Ant Design + `vite-plugin-pwa` |
| Repo layout | Generic monorepo | hub--starter's folder layout (layout only, new code): self-registering modules in `src/features/<key>/` on a shared SDK in `src/shared/`. The same module keys are used in mobile and API |
| Users | Multi-user product | Single account, but `user_id` scoping kept so multi-user stays possible |
| Phase order | Features built (Phase 2) before offline sync (Phase 3) | Local DB, outbox and sync built in Phase 1; every feature built on them |
| Sync cursor | "Server revisions/cursors" (not in schema) | Explicit `sync_changes` table with global `change_seq` |
| Calendar schema | All-day events as `TIMESTAMPTZ`, no occurrence exceptions | All-day as `DATE`, wall-clock + timezone for timed events, exceptions table |
| Reminders | Polymorphic `entity_type`/`entity_id` | Typed foreign keys; Android local notifications as the primary channel |
| Note search | Search over `body JSONB` | Extracted `body_text` + generated `tsvector` |
| Milestones | Release-oriented | Dogfooding-oriented ("uninstalled app X") |

---

## 2. Product principles

1. **One source of truth:** notes, tasks, events, reminders, and projects link together.
2. **Capture first:** any screen can create a note, task, event, or reminder quickly.
3. **Offline by default:** local writes succeed without network access.
4. **Private by design:** minimal data, encrypted transport, visible AI data handling.
5. **Predictable automation:** inspectable, testable, reversible where possible.
6. **Accessible and calm:** keyboard-friendly on web, one-handed on Android, low clutter.
7. **Modular, not over-engineered:** modular monolith; no extra services until a real need exists.
8. **Write logic once:** anything that isn't rendering lives in a shared package used by both clients.

### Success measures (personal)

- Quick capture in two actions or fewer, on both web and Android (including from the Android home screen and share sheet).
- Local UI updates feel immediate (target under 100 ms).
- Changes made on one device appear on the other within a few seconds when both are online.
- Offline edits survive app restarts and sync without silent loss.
- Reminders fire on time on Android, including while offline, and never fire after cancellation.
- Any item can be found through universal search without knowing its module.
- Export and restore of all data works.
- **Apps uninstalled** — the real measure of progress.

---

## 3. Scope

### 3.1 Modules, in suggested build order

Final order is set in Phase 0 by ranking the apps being replaced. Default order:

| # | Module | First-version requirements |
|---|---|---|
| 1 | Quick capture | Global capture on web (`Ctrl/Cmd + K`); Android home-screen shortcut and share-to-app; save locally first |
| 2 | Tasks | Status, priority, due/start dates, subtasks, recurrence, labels, project links, completion history |
| 3 | Today / Home | Today view, overdue items, next events, priorities, quick capture, recent notes |
| 4 | Notes | Rich text, autosave, folders, tags, pinning, archive, search, backlinks, attachments later |
| 5 | Projects | Status, dates, linked tasks/notes, progress summary |
| 6 | Reminders | One-off and recurring, snooze, dismiss, history, quiet hours, time-zone handling |
| 7 | Calendar | Day/week/month/agenda, all-day events, recurrence with exceptions, drag-to-reschedule, task scheduling |
| 8 | Search | Full-text across item types, filters, recent searches |
| 9 | Habits | Schedules, completion logs, streaks, flexible targets |
| 10 | Focus | Timer, sessions, breaks, history linked to tasks/projects |
| 11 | Goals | Goals, milestones, progress, linked projects/tasks, review cadence |
| 12 | Files | Attach to notes/tasks/events, preview, quotas |
| 13 | Automation | Small allowlist of triggers/actions, run history, pause |
| 14 | AI assistant | Summarize, extract tasks, draft plans, weekly review, all via proposals |
| — | Settings | Theme, timezone, week start, notifications, sync status, export/import, devices (built incrementally) |

### 3.2 Out of scope for now

- Windows desktop and iOS clients (Phase 8).
- Public sign-up, billing, multi-tenant admin.
- Team collaboration, shared workspaces, permissions.
- Sync with Google/Microsoft calendars (standalone-first; a one-way ICS import may come later).
- Unreviewed AI actions that delete, move, or rewrite data.
- User scripts or unrestricted code in automations.
- RabbitMQ, Redis, microservices, Kubernetes.

### 3.3 Non-functional requirements

- **Security:** TLS everywhere; Argon2id or a mature identity provider; short-lived access tokens with refresh rotation; rate limiting; input validation.
- **Privacy:** explicit AI opt-in; no note bodies, tokens, or prompts in logs.
- **Reliability:** automated Postgres backups with a tested restore; idempotent jobs; dead-letter handling.
- **Performance:** pagination and virtualized lists; indexed search; lazy-loaded routes on web.
- **Accessibility:** keyboard navigation and visible focus on web; screen-reader labels and large touch targets on Android; reduced-motion support; status never shown by colour alone.
- **Portability:** documented JSON export from early on.

---

## 4. UX

### 4.1 Navigation

**Web (PWA):** collapsible left sidebar — Home, Inbox, Tasks, Notes, Projects, Calendar, Goals & Habits, Focus, Search. Right-side details panel. Command palette on `Ctrl/Cmd + K`. Sync status and notification centre in the header.

**Android:** bottom navigation — Home, Tasks, Notes, Calendar, More. A floating capture button on every main screen. Home-screen quick actions (New task, New note) and a share target so text and links from other apps land in the Inbox.

### 4.2 Home layout

1. Date and sync status.
2. Today timeline with next events.
3. Top priorities and overdue tasks.
4. Quick capture.
5. Upcoming reminders.
6. Habits/focus shortcut (once those modules exist).
7. Recent notes and active projects.

No widget customization until the layout has been lived with for a while.

### 4.3 Key flows

**Quick capture:** open capture → pick Note/Task/Event/Reminder → minimum details → saved locally → syncs in background.

**Note to task:** select text or "Convert to task" → task keeps a link back to the note → due date/priority optional, never blocking.

**Task scheduling:** drag onto calendar (web) or "Schedule" (Android) → creates a linked time block → moving the block does **not** change the task's due date by default.

**AI planning:** user asks → AI reads only approved scope → shows proposed changes → user confirms → changes run through normal services and are logged.

**Offline edit:** local write + outbox in one transaction → "Saved on this device" → sync worker pushes with stable operation IDs → server acknowledges → client pulls, advances cursor, shows any conflicts.

### 4.4 Visual direction — "Ink & Teal"

Taken from the owner's portfolio and its WhatsApp catalogue cards (`Desktop/Experimental/portfolio`): a near-black **ink** background with soft **teal and indigo glows** in the top corners, cards on a slightly lighter surface with faint borders, **teal** as the accent and **indigo** as the second accent, and slate text. Dark is the signature look; light is its equivalent on slate-50. Both follow the system setting by default, and the header has a light / system / dark switch.

**Typography:** **Inter** for everything, with heavy (800), tightly spaced headings. **JetBrains Mono** for small uppercase, letter-spaced labels, like the portfolio's "ELTON CHIPUKA", "FROM" and "01 / 14". The app uses those for the brand mark, page eyebrows, dates and sync status. Times and counts use tabular figures.

**Why:** it matches the owner's own brand. The dark ink is easy on the eyes all day and at night, and with colour kept for accents and states, overdue, due-soon, done and AI items stand out.

#### Palette

Tokens live in `packages/theme`. On the web, `apps/web/src/styles/theme/antdTheme.ts` maps them onto Ant Design's theme tokens and exposes the glows, glass and mono label as CSS variables. On Android they're read directly.

| Token | Dark | Light | Use |
|---|---|---|---|
| `page` | `#0b0f14` | `#f8fafc` | App background (the portfolio's `ink`) |
| `glow` | teal `rgba(45,212,191,.14)` · indigo `rgba(129,140,248,.12)` | teal `.12` · indigo `.10` | Radial glows, top-left and top-right |
| `surface` | `#0f1620` | `#ffffff` | Cards, lists, editor (the portfolio's `surface`) |
| `elevated` / `muted` | `#141d29` / `#131b26` | `#ffffff` / `#f1f5f9` | Popovers; hover and input fill |
| `border` / `borderStrong` | `#1c2532` / `#2a3442` | `#e2e8f0` / `#cbd5e1` | Dividers, card edges / inputs |
| `glass` | surface at 60%, border white 10% | white at 70%, border slate 8% | Sidebar and Android tab bar |
| `heading` | `#f8fafc` | `#0b0f14` | Titles |
| `text` | `#e2e8f0` | `#0f172a` | Body text |
| `textSecondary` | `#94a3b8` | `#475569` | Descriptions, metadata |
| `textMuted` | `#64748b` | `#64748b` | Mono labels, hints (never body text) |
| `primary` | `#2dd4bf` | `#0f766e` | Teal: buttons, links, selection, brand label |
| `primarySoft` / `primaryStrong` | `#0f2e2c` / `#5eead4` | `#ccfbf1` / `#115e59` | Selected rows / hover and selected text |
| `onPrimary` | `#04201d` | `#ffffff` | Text on teal buttons |
| `accent` (+ soft / text) | `#818cf8` (`#1a1e3d` / `#a5b4fc`) | `#4f46e5` (`#e0e7ff` / `#4338ca`) | Indigo: tags and chips, like the "WEBSITES" pill |
| `success` (+ soft / text) | `#4ade80` (`#0f2a1a` / `#86efac`) | `#16a34a` (`#dcfce7` / `#166534`) | Done, streaks |
| `warning` (+ soft / text) | `#fbbf24` (`#2b2211` / `#fcd34d`) | `#d97706` (`#fef3c7` / `#92400e`) | Due soon |
| `error` (+ soft / text) | `#f87171` (`#2e1517` / `#fca5a5`) | `#dc2626` (`#fee2e2` / `#b91c1c`) | Overdue, errors |
| `ai` (+ soft / text) | `#c084fc` (`#24183a` / `#d8b4fe`) | `#9333ea` (`#f3e8ff` / `#7e22ce`) | AI suggestions only |
| radii | 10 / 14 / 16 / pill | same | |

**Contrast (checked 2026-11-06):** all 12 key pairs pass in both modes, from 4.04:1 (dark mono labels on page, which only need 3:1) up to 18.4:1. **Light mode doesn't use the bright teal:** `#2dd4bf` is about 1.8:1 on white, so light mode uses teal-700 `#0f766e` (5.5:1) and indigo-600.

#### Rules

- **Colour carries meaning.** Teal is the brand and primary action and indigo marks tags; green, amber and red mean done, due soon and overdue, and violet means AI. Nothing decorative uses the state colours.
- **Badges** pair a `*Soft` background with the `*Text` colour, never the bright base as text.
- **Pages sit on the ink.** No coloured header blocks: the glows sit behind everything, and content goes in surface cards with faint borders, as in the portfolio. The sidebar is a translucent card (`pp-glass`).
- **Mono labels are small and quiet:** 11–13px, uppercase, about 0.18em tracking, muted, or teal for the brand and page eyebrows. Never for body text.
- **Android:** the header uses a teal-tinted gradient into the ink, with park-check's floating tab-bar pill. There's no `expo-blur` and no `elevation` on translucent views (Android draws a grey rectangle behind them). Fonts come from `@expo-google-fonts/inter` and `jetbrains-mono`, imported one weight at a time, because the packages' index files bundle every weight (about 6 MB).
- **One source of tokens.** Defined once in `packages/theme`, so web and Android can't drift.
- **Dark mode is designed, not inverted.** Surfaces get lighter as they rise (page → surface → elevated), because shadows barely show on ink.
---

## 5. Architecture

### 5.1 Components

- **Web:** Vite + React + TypeScript single-page app, installable PWA via `vite-plugin-pwa`, UI built with Ant Design, folder layout modelled on hub--starter (section 11). All screens are client-rendered and read from the local database. A local-first app doesn't use server rendering, and a static Vite build is also what Tauri wraps later.
- **Android:** React Native with Expo. Native mobile UI, sharing schemas, domain rules, and the sync engine with web.
- **API:** NestJS modular monolith.
- **Worker:** separate Node process from the same codebase for reminders, outbox processing, and later AI/automation jobs.
- **Database:** PostgreSQL as server source of truth, accessed via Prisma with explicit migrations. Raw SQL is fine where Prisma is awkward (change log, advisory locks, full-text search).
- **Local data:** IndexedDB via Dexie on web; `expo-sqlite` on Android. Both behind one `database-local` interface.
- **Jobs/events:** database-backed outbox polled by the worker. No RabbitMQ.
- **Files (later):** Supabase Storage (S3-compatible) with metadata in Postgres, accessed through the API.
- **Hosting:** **Postgres on Supabase** (ADR 0002). Tables live in an `app` schema that Supabase's auto-generated Data API doesn't expose, and Prisma connects through the session pooler. The NestJS API is the only way into the data: no `supabase-js` table queries from clients, because that would be a second write path around sync. The API and worker need a small container host, to be chosen when deploying (one user doesn't need more).

**Later:** Tauri wraps the web app for Windows; the Expo app builds for iOS.

### 5.2 Diagram

```text
        Web / PWA                          Android
        Vite + React (hub layout)          React Native / Expo
        IndexedDB (Dexie)                  SQLite (expo-sqlite)
              \                              /
               \--- shared packages: -------/
                    contracts · domain · sync-engine · database-local
                              |
                        HTTPS REST /api/v1
                              |
                     NestJS modular monolith
        ┌──────────┬──────────┬──────────┬───────────┐
        │ identity │ notes    │ tasks    │ calendar  │
        │ projects │ reminders│ search   │ sync      │
        │ habits   │ focus    │ goals    │ settings  │
        │ files    │ notifs   │ automation│ ai       │
        └──────────┴──────────┴──────────┴───────────┘
                              |
               ┌──────────────┼──────────────┐
           PostgreSQL     Object store    Outbox table
                                              |
                                        Worker process
                                              |
                              Web push · (later) FCM · AI · reports

        Later: Windows (Tauri, wraps web) · iOS (same Expo app)
```

### 5.3 Shared code rule

The PWA and Android app are two UI codebases. To keep that manageable for one person:

- **Shared packages hold:** Zod schemas, domain rules (task state transitions, recurrence expansion, reminder calculation), conflict rules, the sync engine, the typed API client, and the local DB interface.
- **Apps hold:** screens, navigation, and platform adapters (storage, notifications, share intents).
- **Build each feature web-first, then Android,** against the same domain package. If logic is being written a second time in an app, move it into `packages/`.

### 5.4 Backend modules

`identity`, `devices`, `notes`, `tasks`, `projects`, `calendar`, `reminders`, `notifications`, `search`, `sync`, `settings`, `audit`, `health` first. Then `habits`, `focus`, `goals`, `files`, `automation`, `ai`, `analytics` as their phases arrive. Each module owns its use cases, validation, persistence, and events; other modules go through its service or events, not its tables.

### 5.5 API

Versioned REST (`/api/v1`) with OpenAPI. Key endpoints:

- `POST /api/v1/auth/...`
- `POST /api/v1/sync/push` — batch of operations with IDs and base versions
- `GET /api/v1/sync/pull?cursor=<change_seq>`
- `GET /api/v1/notifications`
- `POST /api/v1/ai/proposals/:id/approve` (later)

Since clients read and write the local DB, most CRUD goes through sync push/pull rather than per-entity REST endpoints. Add direct endpoints only where they help (search, file upload, AI). Use request IDs, idempotency, consistent error shapes, and never expose Prisma models as contracts.

---

## 6. Offline-first sync

Highest-risk part of the product. It is built in Phase 1, and every feature sits on it.

### 6.1 Record fields

Every syncable record has: `id` (client-generated UUID), `user_id`, `created_at`, `updated_at` (UTC), `version` (server-incremented, for conflict detection), `deleted_at` (tombstone).

### 6.2 Cursor

The server writes one row to `sync_changes` for every accepted change, in the same transaction as the change. Its `change_seq` (`BIGSERIAL`) is the pull cursor.

- Never use `updated_at` as a cursor. Concurrent transactions can commit out of timestamp order and rows get skipped.
- `BIGSERIAL` values are assigned at insert, not commit, so the same gap can occur. With one user, the simple fix is a transaction-scoped advisory lock per user (`pg_advisory_xact_lock`) around writes to `sync_changes`. Record this in the sync ADR.

### 6.3 Client state

Each client keeps an outbox of pending operations with stable IDs, the last pulled `change_seq`, per-record sync state, and any unresolved conflicts.

### 6.4 Protocol

1. Client writes the record and an outbox operation in one local transaction.
2. Push a batch of pending operations (operation ID, entity, base version, payload).
3. Server checks auth and ownership, validates, and applies each operation idempotently (duplicate operation IDs are acknowledged without re-applying).
4. Per operation the server returns accepted (new version), rejected (reason), or conflict (server copy).
5. Client pulls changes after its cursor and applies them in one transaction, then advances the cursor.
6. Transient failures retry with exponential backoff and jitter.
7. Sync triggers: app start, app foreground, after local writes (debounced), connectivity regained, and a periodic timer while open.

### 6.5 Conflict rules

With one user on two devices, true simultaneous edits are rare, so keep these simple:

- **Notes:** merge metadata fields; if both sides changed the body, keep both and show a "keep this / keep that / keep both" screen. If this becomes annoying, adopt a CRDT (e.g. Yjs) for note bodies only, without changing the rest of the protocol.
- **Tasks:** merge independent fields; surface a conflict only when both sides changed status or due date differently.
- **Calendar events:** surface conflicts for time, timezone, recurrence, or cancellation changes.
- **Habit logs, focus sessions:** append-only records, so no conflicts.
- **Deletes:** tombstones kept long enough that an offline device can't resurrect deleted items (e.g. 90 days, then purge).
- **Preferences:** last write wins is fine.

### 6.6 Sync UX

States: Saved on this device · Syncing · Synced · Offline — changes queued · Needs attention. A diagnostics screen (both clients) shows last successful sync, queued count, failures, and a safe retry.

### 6.7 Limitations to accept

- The PWA cannot schedule reminders on the device. Browsers have no reliable scheduled local notification API, and web push needs the server and a connection. Android is the dependable reminder device.
- Cross-device updates arrive only once both devices have connected.
- Server-side AI needs a connection.
- Large file uploads need resume/retry with visible pending state.

---

## 7. Database

PostgreSQL with UUID keys, foreign keys, migrations, and every query scoped by `user_id`. Timestamps in UTC; IANA timezone names kept for anything recurring. JSONB only for validated flexible data (settings, automation config, rich-text document).

### 7.1 Tables by phase

- **Phase 1:** `users`, `user_sessions`, `devices`, `user_preferences`, `sync_changes`, `outbox_events`, `audit_events`
- **Phase 2:** `tasks`, `task_checklist_items`, `projects`, `notes`, `note_versions`, `folders`, `tags`, `note_tags`, `task_tags`, `entity_links`
- **Phase 3:** `reminders`, `notifications`, `notification_preferences`, `push_subscriptions`, `calendar_events`, `calendar_event_exceptions`
- **Phase 5:** `habits`, `habit_logs`, `focus_sessions`, `goals`, `goal_milestones`, `attachments`, `automations`, `automation_runs`
- **Phase 6:** `ai_conversations` (configurable retention), `ai_action_proposals`
- **Deferred:** `project_members`, `event_attendees`, `task_dependencies`

### 7.2 Core schema (conceptual)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE devices (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,            -- 'web' | 'android' | later 'windows' | 'ios'
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

-- One row per accepted change, written in the same transaction.
-- change_seq is the pull cursor (6.2).
CREATE TABLE sync_changes (
  change_seq BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  operation_id UUID NOT NULL,        -- client operation ID, for idempotency
  op TEXT NOT NULL,                  -- 'upsert' | 'delete'
  version BIGINT NOT NULL,
  origin_device_id UUID REFERENCES devices(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, operation_id)
);
CREATE INDEX sync_changes_pull_idx ON sync_changes (user_id, change_seq);

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,  -- subtasks
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'inbox',
  priority SMALLINT NOT NULL DEFAULT 2,
  -- Due "on a day" vs due "at a time" are different things.
  due_date DATE,
  due_at TIMESTAMPTZ,
  start_date DATE,
  completed_at TIMESTAMPTZ,
  recurrence_rule TEXT,              -- RFC 5545 RRULE
  recurrence_timezone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE notes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  folder_id UUID,
  title TEXT NOT NULL DEFAULT '',
  body JSONB NOT NULL DEFAULT '{}'::jsonb,   -- rich-text editor document
  body_text TEXT NOT NULL DEFAULT '',        -- plain text extracted on save
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', title || ' ' || body_text)
  ) STORED,
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1
);
CREATE INDEX notes_search_idx ON notes USING GIN (search_vector);

-- Timed events: wall-clock + IANA timezone so recurring events stay at
-- 09:00 across DST; starts_at/ends_at are computed UTC instants of the
-- first occurrence, for querying. All-day events are dates, not
-- instants, so they don't shift when travelling.
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,  -- scheduled task block
  title TEXT NOT NULL,
  description TEXT,
  all_day BOOLEAN NOT NULL DEFAULT false,
  local_start TIMESTAMP,             -- wall-clock, no zone
  local_end TIMESTAMP,
  timezone TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  start_date DATE,
  end_date DATE,                     -- exclusive
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1,
  CHECK (
    (all_day AND start_date IS NOT NULL AND end_date > start_date)
    OR (NOT all_day AND local_start IS NOT NULL AND timezone IS NOT NULL
        AND ends_at > starts_at)
  )
);

-- "Move / cancel just this occurrence" of a recurring event.
CREATE TABLE calendar_event_exceptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  original_occurrence TIMESTAMP NOT NULL,   -- wall-clock of replaced instance
  cancelled BOOLEAN NOT NULL DEFAULT false,
  override_local_start TIMESTAMP,
  override_local_end TIMESTAMP,
  override_title TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1,
  UNIQUE (event_id, original_occurrence)
);

-- Typed nullable FKs instead of entity_type/entity_id, so deleting a
-- task can't leave an orphaned reminder.
CREATE TABLE reminders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  CHECK (num_nonnulls(task_id, event_id, note_id) <= 1),  -- 0 = standalone
  title TEXT,                        -- for standalone reminders
  remind_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL,
  recurrence_rule TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled | snoozed | dismissed | done
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL,          -- reminder_id + occurrence time (8.2)
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
```

Add indexes on `(user_id, updated_at)`, `(user_id, due_date)`, `(user_id, due_at)`, `(user_id, starts_at)`, `(user_id, start_date)`, and unread notifications as each table lands.

### 7.3 Data-model rules

- `entity_links` (from/to type + id) is acceptable for the flexible "related items" graph, validated in application code. Anything where integrity matters (reminders, attachments, scheduled task blocks) uses typed foreign keys.
- Tombstones on every syncable record, purged after the retention window.
- Habit logs and focus sessions are append-only.
- Recurrence: RFC 5545 RRULEs plus explicit exception rows; expansion logic lives in `packages/domain` so both clients and the worker compute the same occurrences.
- The local schemas (IndexedDB, SQLite) mirror these tables minus server-only ones (`sync_changes`, `audit_events`, `outbox_events`).

---

## 8. Notifications, reminders, automation

### 8.1 Server pipeline

1. A reminder is created or changed (via sync push).
2. The same transaction writes an outbox event.
3. The worker computes the next occurrence(s) and schedules jobs.
4. At due time it re-checks the reminder still exists and isn't dismissed/snoozed.
5. It inserts a notification with the dedupe key (unique constraint prevents duplicates).
6. It sends web push to subscribed PWA installs.
7. Outcome and retries are recorded; repeated failures go to a dead-letter state.

### 8.2 Reminders across PWA and Android

Reminders must fire even when the phone is offline, so delivery is split by platform:

- **Android (primary):** after each sync, the app schedules upcoming reminders as **local OS notifications** with `expo-notifications`, for a rolling window (e.g. next 14 days, capped around 50 to stay within platform limits). Re-schedule on sync, app start, timezone change, and after reboot. Request the Android 12+ exact-alarm permission for on-time delivery and handle the case where it's denied.
- **PWA (secondary):** in-app inbox while open; web push from the server when online and permission is granted. Best-effort.
- **Deduplication:** each occurrence has a stable key (`reminder_id + occurrence time`). Android uses it as the local notification identifier; the server uses it as `notifications.dedupe_key`.
- **Snooze/dismiss sync:** acting on one device writes a normal synced change; the other device cancels or reschedules on next sync.
- **FCM push to Android: deferred.** Only needed for reminders created on web shortly before they're due while the phone hasn't synced. Add it if that gap shows up in practice.

### 8.3 Automation (Phase 5)

Trigger → conditions → actions → execution policy (immediate / scheduled / approval required) → run history. Small allowlist only. Loop protection, rate limits, max actions per run, a global pause switch, and confirmation for destructive or bulk actions.

---

## 9. AI (Phase 6)

AI proposes; the user decides.

- **Use cases:** notes → tasks, summaries, day/week plan from tasks + calendar, action-item extraction, natural-language search over own content, weekly review, tag/link suggestions.
- **Controls:** explicit consent before sending content to a remote model; least-privilege context (selected note/project, not everything); proposals reviewed before applying; approved actions run through normal services with audit records; no SQL, shell, or arbitrary code from model output; untrusted note content kept separate from system instructions; AI can be disabled and history deleted.
- **Provider:** start with one remote provider behind an abstraction, key stored server-side only. Self-hosted or on-device models are later adapters. The app is fully usable with AI off.

---

## 10. Security, privacy, backups

- TLS for all traffic; Argon2id password hashing or a reputable auth service.
- Refresh tokens stored in OS secure storage on Android (`expo-secure-store`) and httpOnly cookies on web; rotation and revocation.
- No API secrets in client bundles.
- Sanitize rich text and uploads; size/type limits.
- Rate limiting and brute-force protection, even for one user. The server is on the internet.
- Logs never contain note bodies, tokens, or prompts.
- Nightly encrypted Postgres backups stored off the server; restore tested before relying on the app daily (Phase 4 gate).
- Revoke a lost phone from the devices screen.
- **End-to-end encryption: decide in Phase 0.** Without it, whoever can reach the database (you, and Supabase as the host) can read server-side data. With it, server-side search and AI become much harder. For a personal deployment, TLS plus Supabase's encryption at rest and encrypted off-site dumps is a reasonable v1. Record the decision in ADR 0002 either way.
- **Backups on Supabase:** the free plan has no downloadable backups, so a worker job runs a scheduled `pg_dump` stored off Supabase, and the Phase 4 restore drill uses it. Supabase Pro adds daily backups. Note that the free plan also pauses a project after about a week without activity.

---

## 11. Repository structure

The web app uses the **folder layout** of hub--starter (`Desktop/Projects/hub--starter`) as a blueprint: each product area is a **self-registering module** in `src/features/<key>/`, built on a small **module SDK** in `src/shared/`. Creating a module's folder registers it: `src/features/registry.ts` globs every `config/module.tsx`, so there's no list to maintain.

**Only the layout comes from hub--starter. No code does.** Its sign-in (UnifiedAuth), notifications (UnifiedNotifications), account pages, component wrappers and deploy scripts belong to City Parking and are not part of this app. Every file here is written for this project. The UI is built with **Ant Design** (the `antd` library itself), themed with Ink & Teal.

The Android app and the API use the same per-module convention, so a module key (`tasks`, `notes`, …) means the same thing everywhere: the folder name, the route `/<key>`, the API prefix `/api/<key>`, and the prefix on its notification types (`tasks.task.due`).

### 11.1 Monorepo

```text
personal-productivity/
├── apps/
│   ├── web/                       # Vite + React + antd PWA (11.2)
│   ├── mobile/                    # Expo app, same feature-folder convention (11.5)
│   ├── api/                       # NestJS + Prisma on Supabase, one module per feature key (11.6)
│   ├── worker/                    # outbox, reminders, later AI/automation jobs
│   └── desktop/                   # (Phase 8) Tauri shell wrapping apps/web
├── packages/                      # shared by web, mobile, api, worker
│   ├── contracts/                 # Zod schemas, sync operation types, API errors
│   ├── domain/                    # pure rules: task states, due state, later recurrence
│   ├── sync-engine/               # outbox, cursor, push/pull, conflict recording
│   ├── database-local/            # local-DB interface (+ Dexie / expo-sqlite adapters, Phase 0)
│   └── theme/                     # Ink & Teal tokens, radii, Inter + JetBrains Mono
├── module-template/               # copy-and-rename starting point for a new module
│   ├── web/mymodule/              #   → apps/web/src/features/<key>/
│   ├── mobile/mymodule/           #   → apps/mobile/src/features/<key>/
│   └── api/mymodule/              #   → apps/api/src/modules/<key>/
├── scripts/
│   └── emit-mobile-modules.mjs    # generates the mobile registry (11.5)
├── .github/workflows/ci.yml
├── docs/adr/                      # architecture decision records
├── README.md
├── .env.example                   # Supabase connection strings (session pooler, ?schema=app)
├── .nvmrc                         # Node 24
├── tsconfig.base.json
└── package.json                   # npm workspaces
```

npm workspaces avoid the pnpm symlink problems Expo's Metro bundler has in monorepos.

### 11.2 Web app — `apps/web/`

```text
apps/web/
├── index.html                     # Inter + JetBrains Mono from Google Fonts
├── vite.config.ts                 # vite-plugin-pwa, "@/…" alias, /api proxy → NestJS
├── vitest.config.ts · eslint.config.js · tsconfig.json · .env.example
├── public/icon.svg
├── src/
│   ├── main.tsx · App.tsx
│   ├── shared/                    # THE MODULE SDK, one import: "@/shared"
│   │   ├── index.ts
│   │   ├── modules/               #   ModuleManifest + defineModule, registry lookups and checks
│   │   ├── api/                   #   fetch wrapper for server-only calls (search, files, AI)
│   │   ├── page/                  #   ModulePage frame
│   │   ├── data/                  #   opens the local DB and sync runtime; sync triggers. Hooks come from @productivity/sync-engine/react
│   │   ├── sync/                  #   (Phase 4) diagnostics screen
│   │   ├── capture/               #   (Phase 2) global quick capture; modules contribute capture types
│   │   └── search/                #   (Phase 2) universal search; modules contribute providers
│   ├── features/
│   │   ├── registry.ts            # import.meta.glob discovery of */config/module.tsx
│   │   ├── tasks/
│   │   └── notes/                 # further modules join as their phase starts
│   ├── components/layout/         # AppShell: glass sidebar + header over the gradient, solid sheet
│   ├── contexts/                  # ThemeProvider: antd ConfigProvider + light/dark + CSS variables
│   ├── hooks/                     # useMediaQuery, useOnlineStatus
│   ├── pages/
│   │   ├── home/TodayPage.tsx     # quick capture + module widgets
│   │   └── NotFoundPage.tsx
│   ├── routes/index.tsx           # Today + one lazy route per module, generated from the registry
│   └── styles/                    # global.css (glass classes), theme/antdTheme.ts
└── tests/                         # setup.ts, app.test.tsx, shared/
```

There is no sign-in yet. Auth is ADR 0003; Supabase Auth is the leading option. Until it's decided, the API treats every request as `DEV_USER_ID` in development.

### 11.3 A feature module

```text
src/features/tasks/
├── index.tsx                      # the module's own <Routes>, mounted under its basePath
├── config/
│   └── module.tsx                 # manifest: how the shell finds, mounts and lists it
├── data/                          # (Phase 1) local queries and mutations
├── pages/
│   └── HomePage.tsx
├── widgets/
│   └── SummaryWidget.tsx          # its panel on the Today page
└── tests/
    └── module.test.ts
```

**Pages read the local database, not the API.** Synced records (tasks, notes, events, …) are read and written through `@/shared/data`, which uses the local DB and outbox; sync carries changes to the server. `moduleApi()` is only for the few things that need the server.

The manifest (`src/shared/modules/types.ts`) holds `key`, `name`, `description`, `icon`, `basePath`, `order`, `section`, `entities`, `widgets`, `load` and `status`. Later phases add `capture` (quick-capture types), `search` (a search provider over the local DB) and `attention` (computed locally so it works offline). Manifests import `defineModule` from `@/shared/modules/types` rather than `@/shared`, because the registry loads them eagerly and `@/shared` imports the registry.

### 11.4 What the scaffold contains (2026-10-22)

- **Web:** the shell, Today page, a working `notes` module (plain text for now), `tasks` with an empty state, the theme, and tests.
- **Android:** the shell, a working Notes screen on SQLite, and sync status in the header.
- **Local storage and sync (Phase 0 goal, 2026-11-05):** IndexedDB and SQLite implementations of `LocalDatabase` pass one shared test suite. `npm run sync:check` runs the offline-to-online scenario between both storage engines through the real API and Supabase. Still to prove on real hardware: a browser, and `expo-sqlite` on a phone.
- **Not built yet:** the conflict screen (conflicts are recorded with both sides kept, but can't be resolved in the app), and registering devices.
- **Database:** Supabase, set up 2026-10-22 (ADR 0002). Migrations are generated with `prisma:new-migration` (a diff, no shadow database) and applied with `npm run db:migrate`.
- **Not written yet:** deploying the API and worker (the database is Supabase).

### 11.5 Android app — `apps/mobile/`

Uses the same module convention, with native screens:

```text
apps/mobile/
├── app.config.ts · metro.config.js · babel.config.js · eas.json
├── src/
│   ├── App.tsx
│   ├── shared/                    # mobile SDK, same names as web where possible
│   │   ├── data/ · sync/          #   same hooks, backed by expo-sqlite
│   │   ├── auth/                  #   tokens in expo-secure-store
│   │   ├── notifications/         #   expo-notifications local scheduling (8.2)
│   │   ├── capture/               #   capture sheet, home-screen shortcuts, share intent
│   │   └── modules/               #   manifest type, registry lookups
│   ├── features/
│   │   ├── registry.ts            # generated by scripts/emit-mobile-modules.mjs
│   │   └── tasks/
│   │       ├── config/module.ts   # key, name, icon, tab, entities, capture, …
│   │       ├── screens/           # TaskListScreen.tsx, TaskDetailScreen.tsx
│   │       ├── components/
│   │       └── widgets/
│   ├── navigation/                # bottom tabs + stacks built from the registry
│   ├── components/ui/
│   └── theme/                     # same tokens as web styles/theme
└── tests/
```

Metro doesn't support `import.meta.glob`, so the mobile registry can't discover modules the way Vite does. Either generate `registry.ts` from the folder list with a script (matches `emit-modules.mjs`), or use Metro's `require.context`, which Expo enables. Either way, adding a folder still registers the module.

Both apps import `packages/domain`, `packages/contracts`, and `packages/sync-engine`. Each module's `data/` files should be thin wrappers around those, so the web and mobile versions of a module differ only in their screens.

### 11.6 API — `apps/api/`

```text
apps/api/src/
├── main.ts · app.module.ts
├── common/                        # auth guard, error shape, idempotency, request IDs
├── sync/                          # /api/sync/push, /api/sync/pull, sync_changes writer
└── modules/
    ├── identity/ · devices/ · settings/
    ├── tasks/                     # same key as the web/mobile module
    │   ├── domain/ · application/ · infrastructure/ · presentation/
    │   ├── tasks.sync-handler.ts  # validates + applies sync operations for its entities
    │   └── tasks.module.ts
    ├── notes/ · projects/ · reminders/ · calendar/ · notifications/
    └── …                          # one per feature key, as phases arrive
```

Each module registers a sync handler for the entities it owns, so `sync/` stays generic. Module-specific HTTP routes live under `/api/<key>/…`, matching the hub's convention.

### 11.7 Adding a module

1. Pick a key: lowercase, one word, the same in all three apps.
2. Copy `module-template/web/mymodule/` → `apps/web/src/features/<key>/`, and the same for mobile and api. Find and replace `mymodule`/`MyModule`.
3. Add its entities to `packages/contracts` and its rules to `packages/domain`.
4. Fill in the manifest, layout config, and pages/screens.
5. Run `npm run verify` (typecheck, lint, tests) at the root.

Nothing needs registering: the folder is the registration.

---

## 12. Testing

- **Unit (shared packages):** recurrence and DST, task transitions, reminder occurrence calculation, conflict rules, outbox behaviour.
- **Integration (API):** ownership checks, idempotent push, `change_seq` ordering under concurrent writes, outbox processing, notification dedupe.
- **Sync scenarios:** offline edits on each client, duplicate pushes, out-of-order batches, deletes vs offline edits, clock skew, token expiry mid-sync.
- **End-to-end:** capture on Android → appears on web → convert to task → schedule → reminder fires on Android → complete on web.
- **Device tests (real Android phone):** notifications after reboot, with app killed, with battery optimisation on, exact-alarm denied, offline for a day then reconnect.
- **PWA:** install and offline load in Chrome desktop and Chrome Android; service-worker update flow.
- **Security:** auth boundaries, validation, rate limits, dependency scanning.
- **Accessibility:** keyboard flows on web, TalkBack basics on Android.

### Gates before relying on the app daily

- Migrations apply cleanly from empty and from the previous version.
- A backup has been restored successfully.
- Offline changes survive restart and sync without silent loss, on both clients.
- Duplicate pushes don't duplicate changes.
- Cancelled or deleted reminders never fire.
- Export produces a complete, readable JSON file.

---

## 13. Roadmap

Sequenced for earliest daily use. Order is the commitment; dates depend on available time.

**Ordering rule:** the local DB, outbox, and sync loop are built in Phase 1, and every feature is built on them. Nothing is built "online-only first, offline later", because that forces a rewrite of every screen.

### Phase 0 — Decisions and spikes
- Rank the apps being replaced by how often they're opened; adjust module order in 3.1.
- ADRs: E2EE yes/no, auth approach (Supabase Auth is the leading option), AI provider stance. Database hosting is decided: Supabase.
- Spike `database-local` on Dexie and expo-sqlite.
- Test the recurrence/timezone library across DST transitions.
- Two-client sync proof of concept: PWA ↔ Android.

**Exit:** an item edited offline on the phone appears correctly on the PWA after reconnecting, and vice versa.

### Phase 1 — Local-first foundation
- Monorepo, CI, lint, format, typecheck; Expo working inside the monorepo.
- Single-account auth, device registration, settings.
- Postgres schema, `sync_changes`, migrations.
- Local DB + outbox on both clients; push/pull with `change_seq`, idempotency, retries.
- App shells: web sidebar layout and Android bottom nav, themes.
- Sync status indicator; logging; Supabase project and first migration; `pg_dump` backup script.

**Exit:** signed in on both clients; a settings change made offline on one reaches the other after reconnecting.

### Phase 2 — Capture, tasks, notes (first dogfooding milestone)
- Quick capture on both (Android shortcut + share target).
- Tasks, subtasks, priorities, due dates, projects.
- Today view.
- Notes editor with autosave (web rich text; Android editor, which can be WebView-based, e.g. TenTap/Tiptap).
- Links between notes, tasks, projects; basic search.
- Tombstones, version checks, conflict screen.

**Exit:** daily personal use for tasks and notes; at least one replaced app uninstalled.

### Phase 3 — Reminders and calendar
- Reminders with Android local scheduling, snooze, dismiss, recurrence (8.2).
- Worker, outbox processing, notification inbox, web push.
- Calendar: all-day, timed, recurrence with exceptions; task scheduling.
- Quiet hours; cross-device dedupe.

**Exit:** reminders fire on time on Android while offline; cancelled reminders never fire; no duplicates across devices; calendar app uninstalled.

### Phase 4 — Sync hardening and data safety
- Sync diagnostics screen on both clients.
- Cross-device scenario test suite (section 12).
- JSON export/import; restore drill.

**Exit:** a week of normal use with no silent loss or unexplained conflicts; restore verified.

### Phase 5 — Personal planning
- Habits, focus sessions, goals and milestones.
- Weekly review screen; richer Today.
- File attachments.
- Automation with run history and safety controls.

**Exit:** habit/focus apps uninstalled; automations bounded, inspectable, pausable.

### Phase 6 — AI assistant
- Provider abstraction and privacy settings.
- Summaries, task extraction, planning proposals with approval flow.
- Scoped search over own content; AI audit trail and history deletion.

**Exit:** no AI change without approval; everything works with AI off.

### Phase 7 — Hardening
- Security, accessibility, performance passes.
- PWA install polish; signed Android APK or Play internal testing track with an update process.
- Monitoring and crash reporting (e.g. Sentry on web, Android, API).

**Exit:** gates in section 12 pass on PWA and Android; recovery steps documented.

### Phase 8 — Platform expansion
- Windows via Tauri wrapping the web app: OS notifications, opt-in launch-at-startup.
- iOS build of the Expo app; review local-notification limits (64 pending on iOS).
- Optional: open to other users if ever desired.

**Exit:** new clients pass the same sync and reminder gates without changes to shared domain packages.

---

## 14. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Sync complexity | Offline edits can lose data | Built and tested in Phase 0–1; versions, idempotency, tombstones, `change_seq` cursor |
| Solo bandwidth / burnout | One person builds, runs, and uses everything | Dogfood from Phase 2; order by apps retired; defer multi-user concerns |
| Two UI codebases | PWA and React Native screens are written separately | All non-rendering logic in shared packages; web-first then Android per feature |
| PWA reminder limits | Browsers can't schedule local notifications | Android is the reliable reminder device; PWA gets inbox + best-effort push |
| Android background limits | Battery optimisation and exact-alarm rules delay notifications | Exact-alarm permission, reschedule on boot, real-device tests |
| Rich text on React Native | Native rich-text editing is immature | WebView-based editor sharing the web editor's document format |
| Calendar recurrence | DST and exceptions create subtle bugs | Mature RRULE library, wall-clock storage, exceptions table, DST tests |
| Scope creep | Many modules delay usefulness | Strict phase order; each phase ends with an app uninstalled |
| Data loss on own server | It's your only copy of important data | Off-server encrypted backups, restore drill in Phase 4, JSON export |

---

## 15. Build decisions

1. Modular monolith (NestJS) with a separate worker process.
2. TypeScript end to end; Zod contracts shared across web, Android, and API.
3. Offline sync is the foundation, built in Phase 1.
4. Postgres is the source of truth; local DBs are working copies.
5. Database outbox; no RabbitMQ or Redis.
6. Android local notifications are the primary reminder channel.
7. Standalone-first, with no dependency on third-party productivity apps.
8. AI optional, scoped, approval-based.
9. Export, backup, and restore before relying on the app daily.
10. Every phase ends with real daily use and ideally an app uninstalled.

---

## 16. First sprint

- [ ] Monorepo with npm workspaces (`apps/*`, `packages/*`); Expo app running inside it.
- [x] Web shell in hub--starter's folder layout with new code: module registry, antd themed with Ink & Teal, Today page, PWA manifest.
- [ ] Create `module-template/` (web, mobile, api) and build `notes` from it as the first real module.
- [x] CI: lint, typecheck, unit tests, builds (`.github/workflows/ci.yml`).
- [ ] NestJS API with health endpoint; Postgres on Supabase; first migration (`users`, `devices`, `sync_changes`); single `/api` proxy in `vite.config.ts`.
- [ ] Expo Android shell with the generated module registry, importing `contracts` and `domain`.
- [ ] Shared Zod schemas and error conventions.
- [ ] `database-local` interface with Dexie and expo-sqlite adapters.
- [ ] Minimal local note store on both clients.
- [ ] Create/edit offline and persist across reload/restart on both clients.
- [ ] ADR-001: sync protocol (cursor, advisory lock, conflict rules).
- [x] ADR-002: database hosting (Supabase). E2EE still open.

**Do not start with AI, the calendar, or dashboard widgets.** First prove that local persistence and sync work between the PWA and the phone.

---

## 17. Decisions

| Decision | Status |
|---|---|
| Single-user first, multi-user possible later | **Decided:** yes |
| Launch platforms | **Decided:** PWA + Android; Windows and iOS in Phase 8 |
| Stack | **Decided:** Vite + React + Ant Design, Expo, NestJS, Postgres/Prisma on Supabase |
| Repo structure | **Decided:** hub--starter's folder layout (layout only, no code) and module convention across web, mobile, and API (section 11) |
| Primary reminder channel | **Decided:** Android local notifications |
| Database hosting | **Decided:** Supabase Postgres, `app` schema, API as the only way in (ADR 0002) |
| API/worker hosting | Open, decide when deploying |
| End-to-end encryption | Open, Phase 0 ADR (decide first) |
| Auth: Supabase Auth (leading), reuse UnifiedAuth, or a NestJS `identity` module | Open, ADR 0003 |
| AI provider and consent model | Open, before Phase 6 |
| Backup retention and tombstone purge window | Open, before Phase 4 |
| Minimum Android version and browser matrix | Open, Phase 0 (suggest Android 10+, current Chrome/Edge/Firefox) |

Record each as a short ADR in `docs/adr/` with the trade-offs and a date.
