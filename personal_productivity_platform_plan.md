# Personal Productivity Platform
## Product Requirements, Architecture, Data Model, UX Plan, and Delivery Roadmap

**Document status:** Initial product and engineering blueprint  
**Product direction:** Standalone, privacy-conscious, offline-first personal productivity system  
**Target platforms:** Web, Windows desktop, Android, and iOS  
**Architecture direction:** Modular monolith, shared TypeScript domain logic, local-first clients, synchronized server data

---

## 1. Executive summary

Build one personal workspace that brings notes, tasks, calendar, reminders, projects, goals, habits, focus sessions, files, and personal knowledge into a single product. The differentiator is not simply putting many tools in one menu; it is making them work together. A note can become a task, a task can be scheduled, a project can group its notes and tasks, and a single notification center can surface the next useful action.

The product should be **offline-first**: core features remain usable without a connection, changes are stored locally, and a sync engine reconciles them when connectivity returns. Web, Windows, and mobile clients share the same account data and domain rules.

“Standalone” means the product is useful without depending on Google Calendar, Notion, Microsoft To Do, or other productivity services. It does **not** mean that synchronization between devices requires no server. Cross-device synchronization needs a backend or a user-operated self-hosted server. AI features also require either an on-device model or a configured model service; make that choice explicit and privacy-aware.

### Product principles

1. **One source of truth:** notes, tasks, events, reminders, and projects link together.
2. **Capture first:** any screen can create a note, task, event, or reminder quickly.
3. **Offline by default:** local writes succeed without network access.
4. **Private by design:** collect minimal data, encrypt transport and sensitive local storage where practical, and make AI data handling visible.
5. **Predictable automation:** automations are inspectable, testable, and reversible where possible.
6. **Accessible and calm:** keyboard-friendly, responsive, low-clutter interfaces.
7. **Modular, not over-engineered:** start with a modular monolith; extract services only when a demonstrated operational need exists.

---

## 2. Product vision and outcomes

### Vision

A personal productivity operating system that helps one person capture, organize, plan, focus, and review their life from any device.

### Primary outcomes

- Capture a thought in seconds.
- Know what matters today without checking several apps.
- Connect work to its supporting notes, files, goals, and calendar time.
- Receive reminders reliably, including after reconnecting from offline use.
- Plan with AI while retaining user control over decisions and data.
- Move between web, desktop, and mobile without losing context.

### Success measures

Use measurable targets as hypotheses for the beta, then adjust using real usage:

- Quick capture: a new item can be created in two actions or fewer from the global capture surface.
- Perceived responsiveness: common local actions feel immediate; target under 100 ms for local UI updates.
- Sync: online changes normally reach other connected devices within several seconds.
- Offline reliability: queued local changes survive app restarts and reconnect safely.
- Reminder reliability: scheduled reminders are persisted, deduplicated, and auditable.
- Usability: users can find a known item using universal search without knowing its module.
- Trust: users can inspect AI settings, export data, and delete their account/data.

---

## 3. Scope and requirements

### 3.1 Core modules

| Module | First-version requirements |
|---|---|
| Home dashboard | Today view, overdue items, next events, priorities, quick capture, recent notes, focus entry point |
| Notes | Quick notes, rich text, autosave, folders, tags, pinning, archive, search, backlinks/related items, attachments |
| Tasks | Status, priority, due date, start date, subtasks, estimates, recurrence, labels, project links, completion history |
| Calendar | Day/week/month/agenda views, events, all-day events, recurrence, time zones, event reminders, drag-to-reschedule |
| Reminders | One-off and recurring reminders, snooze, dismiss, notification history, quiet hours, time-zone handling |
| Projects | Project status, dates, linked tasks/notes/files, progress summary, project-specific views |
| Goals | Goals, milestones, progress measurements, linked projects/tasks, review cadence |
| Habits | Schedules, completion logs, streaks, flexible targets, missed-day rules |
| Focus | Focus timer, sessions, optional break cycles, session history, link sessions to tasks/projects |
| Files | Upload/import, attach to notes/tasks/events, preview supported formats, metadata and quotas |
| Search | Full-text search across supported item types, filters, recent searches, keyboard shortcut |
| Notifications | In-app inbox, push/browser notifications where supported, email as an optional later channel |
| Settings | Theme, timezone, locale, week start, notifications, privacy, sync status, export/import, device management |
| AI assistant | Summarize notes, extract tasks, draft plans, natural-language search, weekly review, explain proposed actions |
| Automation | User-defined triggers, conditions, actions, run history, pause/disable, duplicate prevention |

### 3.2 Advanced capabilities

- Offline creation and editing of notes, tasks, events, and projects.
- Durable sync queue with retry and conflict handling.
- Cross-device synchronization and visible sync status.
- Recurring task/event/reminder rules with explicit timezone semantics.
- Import/export in documented formats (JSON backup first; Markdown and CSV where useful).
- Global keyboard shortcuts and command palette.
- PWA installation for supported browsers.
- Windows desktop package with OS notifications and launch-at-startup as an opt-in.
- Mobile app with local storage and OS notification scheduling within platform constraints.
- AI-assisted workflows with a confirmation step before destructive or external actions.
- Basic analytics: completed tasks, focus time, habit adherence, and goal progress.
- Data retention and deletion controls.

### 3.3 Explicitly out of scope for v1

- Team collaboration, shared workspaces, and complex permissions.
- Full email client, chat, document editor replacement, or project-management suite for teams.
- Automatic synchronization with Google/Microsoft calendars (standalone-first).
- Unreviewed AI actions that delete, move, or rewrite user data.
- Complex user-created scripts or unrestricted code execution in automations.
- Microservices and Kubernetes before traffic or team size justifies them.

### 3.4 Non-functional requirements

- **Security:** TLS in transit; secure password hashing or a mature identity provider; short-lived access tokens; refresh-token rotation; rate limiting; input validation; audit records for security-sensitive actions.
- **Privacy:** explicit AI opt-in/configuration; clear data-flow explanation; no training on user content by default unless explicitly chosen in a future policy.
- **Reliability:** database backups, tested restore procedure, idempotent jobs, dead-letter handling for failed async work.
- **Performance:** pagination for large lists; indexed search fields; virtualized long lists; lazy-loaded routes.
- **Accessibility:** keyboard navigation, visible focus, screen-reader labels, contrast checks, reduced-motion support.
- **Portability:** user-owned export in a documented format; avoid proprietary data structures where reasonable.
- **Observability:** structured logs, error reporting, queue depth, sync failures, reminder delivery outcomes, and privacy-aware telemetry controls.

---

## 4. Information architecture and user experience

### 4.1 Main navigation

**Primary navigation**
- Home
- Inbox / Quick Capture
- Calendar
- Tasks
- Notes
- Projects
- Goals & Habits
- Focus
- Search

**Global utilities**
- Create (`Ctrl/Cmd + K` command palette and quick capture)
- Notification center
- Sync status
- AI assistant
- Settings and profile

On mobile, use a small bottom navigation for Home, Calendar, Tasks, Notes, and More. Keep quick capture accessible from a prominent action. On desktop, use a collapsible left sidebar and a right-side details panel where useful.

### 4.2 Dashboard layout

Recommended hierarchy:
1. Greeting, date, and sync status.
2. “Today” timeline with the next calendar events.
3. Top priorities and overdue tasks.
4. Quick capture field.
5. Upcoming reminders.
6. Active goals/habits and focus session shortcut.
7. Recently edited notes and active projects.

Make widgets reorderable only after the core layout is stable; too much customization early increases complexity.

### 4.3 Key interaction flows

**Quick capture**
1. Open the global capture surface.
2. Choose Note, Task, Event, Reminder, or allow a safe classifier to suggest a type.
3. Enter the minimum details.
4. Save locally immediately.
5. Sync in the background when online.

**Note to task**
1. Select text or use “Convert to task.”
2. Preserve a source link to the note and optional selected text.
3. Ask for due date/priority only if useful; never block capture on optional metadata.

**Task scheduling**
1. Drag a task into a calendar slot or choose “Schedule.”
2. Create a calendar block linked to the task.
3. Decide explicitly whether moving the block changes the task due date; default to not changing it.

**AI-assisted planning**
1. User asks for a plan.
2. AI reads only the selected context or scopes the user approved.
3. Show a proposed list of changes.
4. User reviews and confirms.
5. Execute actions through normal application services and log the outcome.

**Offline-to-online sync**
1. User edits a local item.
2. Client writes to local database and an outbox transactionally.
3. UI shows “Saved on this device” / “Waiting to sync.”
4. Sync worker sends queued operations with stable operation IDs.
5. Server validates and acknowledges.
6. Client updates sync cursor and resolves any conflicts visibly.

### 4.4 Visual design direction

- **Style:** calm, focused, modern, minimal, warm rather than sterile.
- **Suggested palette:** deep ink/navy for navigation, warm off-white surfaces, muted blue for primary actions, green for completion, amber for due-soon, red only for errors/overdue states, lavender as an optional AI accent.
- **Typography:** Inter or a similar highly legible UI sans-serif; use a restrained type scale.
- **Components:** accessible component primitives, consistent spacing, clear empty states, skeleton loading, toasts for transient feedback, and persistent status for sync errors.
- **Density:** comfortable by default with an optional compact mode.
- **Themes:** light and dark, with system preference support.
- **Avoid:** excessive gradients, too many accent colors, dashboard overload, and color-only status indicators.

### 4.5 Accessibility and responsive behavior

- Support keyboard-only navigation and shortcuts.
- Do not rely on hover as the only way to reveal actions.
- Use labels and accessible names for icon buttons.
- Provide text labels in addition to status colors.
- On narrow screens, prioritize one-column flows and full-screen editors.
- Keep critical actions reachable with one hand on mobile.
- Respect OS reduced-motion and text-size preferences.

---

## 5. Recommended technical architecture

### 5.1 High-level design

Use a **modular monolith backend** and three client shells sharing domain contracts and UI/business logic where platform differences allow:

- **Web:** Next.js + React + TypeScript, installable PWA.
- **Windows:** Tauri desktop shell with a shared web UI; native integration for notifications and file access.
- **Mobile:** React Native with Expo; share TypeScript schemas and domain packages, but use native mobile UI rather than forcing all web components into mobile.
- **API:** Node.js + NestJS modular monolith.
- **Database:** PostgreSQL as the server source of truth.
- **Local data:** IndexedDB (via Dexie or equivalent) on web; SQLite on desktop/mobile.
- **Data access:** Prisma for server-side relational access; use explicit migrations and constraints.
- **Jobs/events:** start with a database-backed job/outbox pattern. Add RabbitMQ when asynchronous workload and independent consumers justify it.
- **Redis:** optional for rate limits, short-lived cache, distributed locks, or job coordination; not the source of truth.
- **Files:** S3-compatible object storage, with metadata in PostgreSQL. Support local-only attachment staging while offline.
- **Observability:** structured logs, error reporting, metrics, tracing as complexity grows.
- **Deployment:** Dockerized API and worker; managed PostgreSQL or a maintained self-hosted PostgreSQL instance.

### 5.2 Architecture diagram

```text
 Web / PWA           Windows (Tauri)          Android / iOS
 Next.js + React     Shared React UI          React Native / Expo
 IndexedDB           SQLite                   SQLite
       \                 |                       /
        \------ Local-first client sync -------/
                          |
                    HTTPS REST API
                          |
                 NestJS Modular Monolith
     ┌──────────┬─────────┼──────────┬───────────┐
     │ Identity │ Notes   │ Tasks    │ Calendar  │
     │ Projects │ Goals   │ Habits   │ Reminders │
     │ Search   │ AI      │ Automation│ Files    │
     │ Sync     │ Settings│ Analytics│ Notifs    │
     └──────────┴─────────┼──────────┴───────────┘
                          |
          ┌───────────────┼────────────────┐
          │               │                │
      PostgreSQL       Object store    Outbox / Jobs
                                           |
                                   Worker process
                                           |
                              RabbitMQ (when justified)
                                           |
                              Notifications / AI / reports
```

### 5.3 Modular boundaries

Each backend module should own its use cases, validation, persistence access, and events. Other modules should call its application service or consume a documented domain event, rather than reaching into its tables arbitrarily.

Suggested modules:
- `identity`
- `users`
- `devices`
- `notes`
- `tasks`
- `calendar`
- `reminders`
- `projects`
- `goals`
- `habits`
- `focus`
- `files`
- `search`
- `notifications`
- `automation`
- `ai`
- `sync`
- `analytics`
- `settings`
- `audit`
- `health`

Keep business rules in domain/application services, not React components or controllers.

### 5.4 API approach

Start with a versioned REST API (`/api/v1`) using OpenAPI. REST is easy to inspect and works well with sync batches. Consider WebSockets or Server-Sent Events only for live updates where they add value; periodic sync remains necessary for offline recovery.

Example endpoints:
- `POST /api/v1/auth/...`
- `GET /api/v1/tasks?updatedSince=...`
- `POST /api/v1/sync/push`
- `GET /api/v1/sync/pull?cursor=...`
- `POST /api/v1/notes`
- `PATCH /api/v1/tasks/:id`
- `POST /api/v1/calendar/events`
- `POST /api/v1/automations/:id/test`
- `GET /api/v1/notifications`
- `POST /api/v1/ai/proposals/:id/approve`

Use request IDs, pagination, validation, idempotency keys for retried writes, and consistent error shapes. Do not expose internal database models directly as API contracts.

---

## 6. Offline-first synchronization design

This is one of the highest-risk parts of the product. Design and test it early rather than adding offline support at the end.

### 6.1 Local data model

Each syncable record should include:
- `id`: UUID generated on the client or server.
- `owner_id`: account/tenant boundary.
- `created_at`, `updated_at`: UTC timestamps.
- `version`: server-managed or monotonically increasing revision.
- `deleted_at`: tombstone timestamp for deletions.
- `origin_device_id`: device that initiated the last local change, where useful.

Each local client also maintains:
- an operation outbox with stable operation IDs,
- a last successful pull cursor,
- per-record sync state,
- conflict records that require user attention.

### 6.2 Push/pull protocol

1. Client commits the item change and outbox operation in one local transaction.
2. Push a batch of pending operations with unique IDs and base versions.
3. Server authenticates, validates ownership and payloads, then processes each operation idempotently.
4. Server returns accepted, rejected, or conflict results per operation.
5. Client pulls server changes after its cursor.
6. Client applies changes transactionally and advances the cursor only after successful application.
7. Retry transient failures with exponential backoff and jitter.

Never rely only on client clocks for ordering. Use server revisions/cursors for authoritative change order.

### 6.3 Conflict policy

Use per-entity policies instead of one universal rule:

- **Notes:** preserve versions; attempt field-level merge for structured metadata, and retain conflicting body versions rather than silently overwriting meaningful edits.
- **Tasks:** merge independent fields where safe; surface conflicts for status/due-date changes that cannot be reconciled confidently.
- **Calendar events:** treat time, timezone, recurrence, and cancellation changes carefully; show a conflict resolution screen for overlapping edits.
- **Habits/logs/focus sessions:** append immutable completion/session records where practical, reducing conflicts.
- **Deletes:** use tombstones and retention windows so offline devices do not resurrect deleted items.
- **Automation runs/notifications:** use idempotency keys to prevent duplicates.

A “last write wins” policy may be acceptable for low-risk preferences, but should not be the blanket rule for notes or calendar events.

### 6.4 Sync user experience

Show clear states:
- Saved on this device
- Syncing
- Synced
- Offline — changes queued
- Needs attention — conflict or authentication required

Provide a sync diagnostics page with last successful sync, queued item count, failed items, and a safe retry action. Avoid exposing sensitive note content in logs.

### 6.5 Offline limitations to disclose

- Push notifications may be delayed or unavailable while a device is offline.
- Server-side AI cannot run without a connection unless a local model is installed and supported.
- Cross-device updates cannot arrive until both devices can connect.
- Browser background execution and notification capabilities vary by browser and OS.
- Large file uploads should resume or retry; keep local pending uploads visible.

---

## 7. Database design

Use PostgreSQL with UUID primary keys, foreign keys, indexes, migrations, and row-level ownership checks. Store timestamps in UTC; preserve IANA timezone names for calendar rules. JSONB is suitable for validated flexible settings or automation configuration, not as a substitute for relational structure.

### 7.1 Main entity groups

**Identity and devices**
- `users`
- `user_sessions` or refresh-token records
- `devices`
- `user_preferences`

**Productivity records**
- `notes`
- `note_versions`
- `folders`
- `tags`
- `note_tags`
- `tasks`
- `task_dependencies`
- `task_checklist_items`
- `projects`
- `project_members` (defer collaboration use if single-user)
- `calendar_events`
- `event_attendees` (can be deferred)
- `reminders`
- `goals`
- `goal_milestones`
- `habits`
- `habit_logs`
- `focus_sessions`
- `attachments`
- `entity_links` (typed links between supported records)

**Platform and automation**
- `notifications`
- `notification_preferences`
- `automations`
- `automation_runs`
- `sync_operations` or server change log
- `outbox_events`
- `audit_events`
- `ai_conversations` (optional, configurable retention)
- `ai_action_proposals`

### 7.2 Example relational schema (conceptual)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- nullable if using external identity provider
  display_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE devices (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE notes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'inbox',
  priority SMALLINT NOT NULL DEFAULT 2,
  start_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1,
  CHECK (ends_at > starts_at)
);

CREATE TABLE reminders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT,
  entity_id UUID,
  remind_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL,
  recurrence_rule TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL,
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

This is a starting point, not a complete production migration. Add `tags`, join tables, note versions, habit logs, goals, automation definitions, outbox/change-log tables, indexes, and constraints in deliberate migrations.

### 7.3 Important data-model decisions

- Prefer explicit `entity_links` for flexible cross-module links; enforce valid entity types in application code or via a safer typed relation design.
- Avoid polymorphic foreign keys when referential integrity is critical. For attachments and reminders, consider separate link tables or typed foreign-key columns.
- Use soft deletion/tombstones for syncable records; define when permanent deletion occurs.
- Keep habit completions and focus sessions as append-oriented records.
- Use recurrence standards such as RFC 5545-compatible rules where practical, with careful exception handling.
- Store local timezone identifiers in addition to UTC instants.
- Add indexes for `(user_id, updated_at)`, `(user_id, due_at)`, `(user_id, starts_at)`, unread notifications, and full-text search.
- Scope every query by the authenticated user; add row-level security only if the operational model and connection pooling are designed for it.
- Keep AI conversation retention configurable and separate from primary productivity records.

---

## 8. Notifications and automation architecture

### 8.1 Notification pipeline

1. A task, event, or reminder is created or changed.
2. The application transaction writes the domain change and an outbox event atomically.
3. A worker consumes the outbox and calculates scheduled jobs.
4. At due time, the worker checks whether the reminder is still valid and not already delivered.
5. It creates an in-app notification using a unique deduplication key.
6. Optional channels deliver browser/mobile push or email.
7. Delivery outcome and retry state are recorded.

Use an outbox pattern to avoid losing events between a database commit and message publication. If RabbitMQ is introduced, use durable queues, publisher confirms, acknowledgements, retry limits, and a dead-letter queue. Consumers must be idempotent because at-least-once delivery can produce duplicates.

### 8.2 Automation model

A safe automation has:
- Trigger: e.g. task completed, due date approaching, every weekday at 08:00.
- Conditions: e.g. project equals “Personal”, priority is high.
- Actions: e.g. create notification, add a task, summarize a project.
- Execution policy: immediate, scheduled, or approval required.
- Run history: status, timestamps, outcome, and safe error message.

Start with a small allowlist of triggers and actions. Include loop protection, rate limits, maximum action counts, and a pause switch. Require confirmation for destructive or broad bulk actions.

---

## 9. AI design and privacy

Treat AI as a module that proposes useful work, not as an unrestricted agent.

### 9.1 High-value use cases

- Turn rough notes into structured tasks.
- Summarize long notes and project activity.
- Generate a day/week plan from selected tasks and calendar availability.
- Extract action items from text.
- Answer natural-language questions over the user's own indexed content.
- Draft a weekly review and highlight overdue commitments.
- Suggest tags or links between related notes.

### 9.2 Safety and control

- Ask for explicit permission before sending private content to a remote model.
- Use least-privilege context: selected note or selected project rather than the entire database by default.
- Show proposed changes before applying them.
- Execute approved actions through regular application services, with validation and audit records.
- Do not allow model output to execute arbitrary SQL, shell commands, or unrestricted automation code.
- Separate trusted system rules from untrusted note content to reduce prompt-injection risks.
- Allow users to disable AI and delete AI history.
- Do not claim AI works offline unless a supported local model is configured.

### 9.3 Standalone AI options

**Option A — Remote provider behind an abstraction:** fastest to implement, but requires network access and clear disclosure of data sent to the provider.

**Option B — User-configured self-hosted model:** more control and can keep inference within the user's infrastructure, but adds deployment and maintenance work.

**Option C — On-device model:** strongest offline potential, but model quality, memory use, battery, latency, and device compatibility vary.

Recommended approach: ship the AI interface and provider abstraction early, initially support one configured provider with explicit consent, and keep local/self-hosted inference as a planned adapter. The core app must remain fully usable with AI disabled.

---

## 10. Security, privacy, backups, and recovery

- Use TLS for every network connection.
- Hash passwords with Argon2id or use a reputable authentication service.
- Store refresh tokens securely and rotate/revoke them.
- Encrypt sensitive local data where practical; use OS secure storage for secrets.
- Never embed API secrets in web, desktop, or mobile client bundles.
- Validate and sanitize rich text and uploaded files.
- Apply file type/size limits and malware scanning where the deployment supports it.
- Add per-account rate limits and brute-force protection.
- Keep logs free of note bodies, credentials, tokens, and private AI prompts by default.
- Offer account export and a clearly documented deletion process.
- Back up PostgreSQL regularly, encrypt backups, and test restores.
- Set a recovery-point objective and recovery-time objective before production.
- Revoke lost devices and invalidate their sessions.
- Provide a security review before public release.

For a genuinely private self-hosted deployment, document that the operator of the server may still have access to server-side data unless end-to-end encryption is implemented. End-to-end encryption complicates server-side search, AI, and cross-device recovery; decide deliberately rather than implying that TLS alone provides it.

---

## 11. Repository structure

A monorepo supports shared contracts while keeping platform-specific code separated.

```text
personal-productivity/
├── apps/
│   ├── web/                       # Next.js PWA
│   ├── desktop/                   # Tauri Windows shell
│   ├── mobile/                    # React Native / Expo
│   ├── api/                       # NestJS modular monolith
│   └── worker/                    # Reminder, automation, AI jobs
├── packages/
│   ├── domain/                    # Shared pure business rules
│   ├── contracts/                 # Zod schemas, API DTOs
│   ├── api-client/                # Typed API client
│   ├── sync-engine/               # Outbox, cursors, conflict rules
│   ├── database-local/            # Local database adapters
│   ├── ui-web/                    # Shared web UI components
│   ├── config/                    # Lint, TS, formatting config
│   └── test-utils/
├── infrastructure/
│   ├── docker/
│   ├── deployment/
│   ├── monitoring/
│   └── backup/
├── docs/
│   ├── product-requirements.md
│   ├── architecture.md
│   ├── database.md
│   ├── sync-protocol.md
│   ├── security-and-privacy.md
│   └── runbooks/
├── scripts/
├── .env.example
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

### Example backend module

```text
apps/api/src/modules/tasks/
├── domain/
│   ├── task.entity.ts
│   ├── task.rules.ts
│   └── task.events.ts
├── application/
│   ├── create-task.use-case.ts
│   ├── update-task.use-case.ts
│   └── complete-task.use-case.ts
├── infrastructure/
│   ├── task.repository.ts
│   └── task.mapper.ts
├── presentation/
│   ├── tasks.controller.ts
│   └── tasks.dto.ts
└── tasks.module.ts
```

Keep this structure proportional to actual complexity. A module need not have every file on day one, but preserve clear separation between domain rules, application use cases, database access, and transport.

---

## 12. Testing and quality strategy

### Automated tests

- **Unit tests:** recurrence rules, task state transitions, conflict resolution, reminder calculation, automation safety rules.
- **Integration tests:** database constraints, API ownership checks, outbox processing, idempotency, notification scheduling.
- **Sync tests:** offline edits, duplicate requests, out-of-order batches, deleted records, clock skew, token expiry, simultaneous edits.
- **End-to-end tests:** capture note, convert to task, schedule task, receive reminder, complete task.
- **Cross-platform tests:** web browser support, Windows install/update, Android/iOS notification and offline behavior.
- **Security tests:** authorization boundaries, input validation, upload handling, rate limits, dependency scanning.
- **Accessibility tests:** keyboard flows, contrast, labels, screen-reader basics.

### Release gates

Do not release a build unless:
- migrations work from a clean database and upgrade a previous version;
- backup restoration has been exercised;
- offline changes survive restart and sync without silent data loss;
- duplicate sync requests do not duplicate actions;
- reminders are not sent after cancellation or deletion;
- user A cannot access user B's data;
- account export and deletion paths are verified;
- critical flows work on every supported platform.

---

## 13. Phased implementation roadmap

Timelines depend on team size and experience. The following is a staged sequence, not a guarantee of duration.

### Phase 0 — Discovery and technical spikes
**Deliverables**
- Finalize user stories and acceptance criteria.
- Decide hosting and account model.
- Prototype local storage on each platform.
- Test recurrence/timezone library.
- Build a small offline sync proof of concept with two clients.
- Document AI data-flow choices and threat model.

**Exit criteria:** sync/conflict assumptions are tested before feature expansion.

### Phase 1 — Foundation
**Deliverables**
- Monorepo, CI, linting, formatting, environment configuration.
- Authentication, device registration, user settings.
- PostgreSQL schema and migration workflow.
- Shared API contracts and error format.
- Base navigation, theme, responsive layout.
- Logging, backup plan, and development Docker environment.

**Exit criteria:** user can sign in on supported clients and access a protected profile/settings screen.

### Phase 2 — Core productivity
**Deliverables**
- Notes editor with autosave and local persistence.
- Tasks, subtasks, priorities, due dates, and projects.
- Calendar events and basic recurrence.
- Quick capture and dashboard.
- Links between notes, tasks, projects, and events.
- Universal search foundation.

**Exit criteria:** primary workflows operate locally and online without duplicated domain logic.

### Phase 3 — Offline and sync
**Deliverables**
- Local databases and transactional outbox.
- Push/pull sync API, cursors, idempotency, retries.
- Tombstones, version checks, and conflict UI.
- Sync status and diagnostics.
- Cross-device end-to-end test suite.

**Exit criteria:** supported records can be created/edited offline, survive restart, and reconcile after reconnecting without silent loss.

### Phase 4 — Reminders and notifications
**Deliverables**
- Durable scheduler and reminder evaluation.
- In-app notification inbox.
- Browser/desktop/mobile push where supported.
- Quiet hours, snooze, recurring reminders, deduplication.
- Outbox worker and retry/dead-letter handling.

**Exit criteria:** cancelled reminders are suppressed and repeated jobs do not create duplicate notifications.

### Phase 5 — Advanced personal planning
**Deliverables**
- Goals, milestones, habits, focus sessions.
- Richer dashboard and weekly review.
- File attachments and backup/export/import.
- Automation rules with run history and safety controls.

**Exit criteria:** automation actions are bounded, inspectable, and can be paused.

### Phase 6 — AI assistant
**Deliverables**
- Provider abstraction and privacy settings.
- Note summarization and task extraction.
- Planning proposals and user approval flow.
- Scoped retrieval/search over user content.
- AI audit trail and history deletion controls.

**Exit criteria:** no AI action changes data without authorization, and core features remain functional with AI disabled.

### Phase 7 — Hardening and release
**Deliverables**
- Security review, accessibility review, performance profiling.
- Windows packaging and update process.
- PWA install flow and mobile store/internal distribution.
- Backup restore drill, monitoring, crash reporting.
- Data export/deletion verification and release documentation.

**Exit criteria:** release gates pass on all supported platforms; rollback and recovery steps are documented.

---

## 14. Main risks and mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Sync complexity | Offline edits and concurrent updates can lose data | Prototype early; use versions, idempotency, tombstones, explicit conflict rules |
| Scope creep | Many modules can delay a usable release | Keep a strict phase plan; deliver the core capture-plan-review loop first |
| Notification inconsistency | OS/browser background behavior differs | Persist schedules server-side; use platform-specific adapters; disclose offline limits |
| AI privacy | Personal notes may be sensitive | Explicit consent, minimal context, configurable provider, retention controls |
| Calendar recurrence | DST and timezone changes create subtle bugs | Use mature recurrence libraries and test timezone transitions |
| Desktop/mobile divergence | Shared code cannot erase platform differences | Share domain contracts; use platform-native shells and focused adapters |
| Data lock-in | User may rely on the app for years | Documented export format, backup/restore, migration discipline |
| Operational overhead | RabbitMQ and extra services add maintenance | Begin with database outbox/worker; add RabbitMQ when justified |

---

## 15. Recommended build decisions

1. **Start with a modular monolith**, not microservices.
2. **Use TypeScript end to end** for domain contracts and shared validation.
3. **Treat offline sync as a foundational subsystem**, not a later enhancement.
4. **Use PostgreSQL as the server source of truth** and local databases as client working copies.
5. **Use a durable outbox pattern** for sync and notifications; introduce RabbitMQ when the need is real.
6. **Keep the product standalone-first** with no mandatory dependency on third-party productivity apps.
7. **Make AI optional and privacy-aware**, with explicit approvals for data-changing actions.
8. **Ship export, backup, and restore early** because the application will hold valuable personal data.
9. **Build a useful end-to-end workflow before adding every advanced module.**
10. **Test on real devices early**, especially offline sync, time zones, and OS notifications.

## 16. First sprint backlog

A practical first sprint should prove the foundations, not attempt every module.

- [ ] Create the monorepo and package workspace.
- [ ] Add CI checks, formatting, linting, and type checking.
- [ ] Create the NestJS API and health endpoint.
- [ ] Start PostgreSQL through Docker Compose and add migrations.
- [ ] Create the Next.js web shell with navigation and theme.
- [ ] Define shared Zod schemas and API error conventions.
- [ ] Add user/device identity model.
- [ ] Implement a minimal local note store.
- [ ] Demonstrate create/edit while offline and persist across reload.
- [ ] Write the first sync protocol ADR (architecture decision record).
- [ ] Document local development and backup assumptions.

**Do not start with AI, RabbitMQ, or a large collection of dashboard widgets.** First prove that the data model, local persistence, and sync path are sound.

---

## 17. Decisions to finalize before implementation

- Is the backend cloud-hosted, self-hosted, or both?
- Is the app single-user initially, while allowing a future multi-user architecture?
- Which local encryption and recovery model is acceptable?
- Which AI mode is preferred: remote provider, self-hosted model, or on-device?
- Which notification channels are required at launch?
- What are the backup retention and data deletion policies?
- What is the minimum Windows, Android, iOS, and browser support matrix?

These choices should be recorded as short architecture decision records (ADRs), with trade-offs and a date, rather than buried in code.

---

## Conclusion

The strongest version of this product is a privacy-conscious, offline-first workspace where notes, tasks, calendar, reminders, projects, goals, habits, and AI-assisted planning share one consistent data model. Build the sync foundation and core workflows first, keep the backend modular, and add automation and AI behind clear permission boundaries. This gives you a realistic path to a powerful personal platform without turning the first release into an unmaintainable collection of disconnected features.
