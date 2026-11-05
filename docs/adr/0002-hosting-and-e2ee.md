# ADR 0002: Hosting and end-to-end encryption

**Date:** 2026-10-21, hosting decided 2026-10-22

## 1. Database hosting — Decided: Supabase

**Decision:** the Postgres database runs on Supabase (the owner already has an account). The NestJS API connects to it through Prisma, exactly as it would to any Postgres. The API and worker still need a host; that is a separate, later decision.

**Why:** managed Postgres with nothing to install or run locally (Docker isn't installed, and port 5432 is already used by another Postgres on the development machine). It also keeps two doors open: Supabase Auth for ADR 0003, and PowerSync, which plugs into Supabase, if the hand-built sync engine ever becomes a burden.

**How it's used (rules):**
- **Session pooler** connection string for both `DATABASE_URL` and `DIRECT_URL`. The direct connection is IPv6-only without the paid IPv4 add-on; the transaction pooler (port 6543) breaks Prisma's prepared statements and the per-user advisory lock in ADR 0001.
- **Tables live in the `app` schema**, not `public`. Supabase's auto-generated Data API exposes `public` to anyone holding the project's public key; `app` is not exposed, and the init migration also revokes `anon` / `authenticated` access to it.
- **The NestJS API is the only way into the data.** No `supabase-js` table queries from the browser or phone, because a second write path would bypass sync (plan §6).
- **Migrations** are generated with `npm run prisma:new-migration -w @productivity/api -- <name>` (a diff against the live database, no shadow database) and applied with `npm run db:migrate`.
- **Region:** the closest available to the owner.

**Consequences and limits:**
- **Free plan pauses** a project after about a week without activity. Daily use keeps it awake; a pause needs a manual restore in the dashboard.
- **Free plan has no downloadable backups.** The plan's restore drill (Phase 4) therefore needs our own scheduled `pg_dump` (a worker job), stored off Supabase. Upgrading to Pro adds daily backups.
- Connection limits on the pooler are fine for one user; revisit if that ever changes.

## 2. End-to-end encryption — Open

**Status:** decide before Phase 1 data work.

- **Without E2EE:** Supabase (as the host) and anyone with the database credentials can read stored data. Server-side search and AI work normally. TLS, Supabase's encryption at rest, and encrypted off-site dumps cover most personal risk.
- **With E2EE:** the database only stores ciphertext. Server-side search and AI need a different design (client-side indexes, on-device or user-keyed AI), and losing the key loses the data.

The plan (§10) suggests no E2EE for v1. Record the choice here with the date.

**Decision:** _Not yet made._
