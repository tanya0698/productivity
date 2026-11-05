# Personal Productivity Platform

One offline-first workspace for notes, tasks, calendar and reminders. Web (PWA) and Android first; Windows and iOS later.

- **Plan:** [personal_productivity_plan_pwa_android.md](personal_productivity_plan_pwa_android.md) (the original [personal_productivity_platform_plan.md](personal_productivity_platform_plan.md) is kept for reference)
- **Theme:** "Lavender Glass", tokens in [packages/theme](packages/theme/src/index.ts), plan §4.4
- **Decisions:** [docs/adr/](docs/adr/)

## Layout

```text
apps/
  web/       Vite + React + Ant Design PWA; self-registering modules in src/features/<key>/
  mobile/    Expo / React Native Android app, same module convention
  api/       NestJS + Prisma on Supabase Postgres, one module per feature key, /api/sync for all synced records
  worker/    Background jobs (outbox, reminders) — loop only, jobs arrive in Phase 3
packages/
  contracts/       Zod schemas: entities, sync operations, API errors
  domain/          Pure rules shared by every client (task status, due state)
  sync-engine/     Outbox + push/pull, same code on web and Android
  database-local/  One local-DB interface; in-memory reference adapter
  theme/           Lavender Glass colours, glass, radii, Manrope
module-template/   Copy-and-rename starting points for a new module (web, mobile, api)
docs/adr/          Architecture decision records
scripts/           emit-mobile-modules.mjs (generates the Android module registry)
```

A module key (`tasks`, `notes`, …) is the same folder name in all three apps, the web route `/<key>`, and the API prefix `/api/<key>`.

## First run

Requires Node 24 (`.nvmrc`) and a Supabase project (the database, ADR 0002).

```bash
npm install
cp .env.example .env      # paste your Supabase session-pooler string into DATABASE_URL and DIRECT_URL
npm run db:migrate        # creates the tables in the `app` schema
npm run dev:api           # http://localhost:3000/api/health → "database": "up"
npm run dev:web           # http://localhost:5173 (proxies /api to the API)
npm run dev:mobile        # Expo; needs a dev build or emulator for Android
```

**Changing the schema:** edit `apps/api/prisma/schema.prisma`, then

```bash
npm run prisma:new-migration -w @productivity/api -- add_reminders   # writes the SQL; review it
npm run db:migrate
```

Tables live in the `app` schema, not `public`, so Supabase's auto-generated Data API can't reach them; the NestJS API is the only way in. Don't move them to `public` or query them from the browser with `supabase-js`.

There is no sign-in yet (ADR 0003, Supabase Auth is the leading option). In development the API treats every request as `DEV_USER_ID`.

## Checks

```bash
npm run verify     # typecheck, lint, test across every workspace
```

## Adding a module

1. Pick a key: lowercase, one word, the same everywhere.
2. Copy `module-template/web/mymodule` → `apps/web/src/features/<key>`, and likewise for `mobile` and `api`. Find and replace `mymodule` / `MyModule`.
3. Add its entity to `packages/contracts` and its rules to `packages/domain`.
4. Register the API module and its sync handler (see the comment in `module-template/api/mymodule/mymodule.module.ts`).
5. `npm run verify`.

The web and mobile apps discover modules from their folders; there is no list to edit.
