# Deploying Creedence: the database connection

An addition to `DEPLOY.md`: set `DATABASE_URL` this way on every host (Render,
and your local `.env`), or sync stops once more than one process is connected.

## The two connection strings

Both come from the same Supabase pooler host (Supabase dashboard → Connect).

| Variable | Used by | Pooler | Port | Extra options |
|---|---|---|---|---|
| `DATABASE_URL` | API and worker, at run time | **Transaction** | **6543** | `&pgbouncer=true&connection_limit=3` |
| `DIRECT_URL` | migrations (`npm run db:migrate`, the Render build) | Session | 5432 | none |

Both keep `?schema=app&sslmode=require&connect_timeout=30`.

## What happens with the session pooler

The session pooler (5432) keeps one of a handful of free-tier slots for every
open connection, and each Prisma client opens about nine. Once the hosted API
(with its worker), a local API and a local worker were all connected, the slots
ran out: requests waited and timed out, and sync stopped, while
`/api/health`, a single quick query, could still say the database was up.

The transaction pooler (6543) holds a slot only while a query or transaction
runs, so all of them share it.

- `pgbouncer=true`: Prisma stops using prepared statements, which the
  transaction pooler can't carry between queries.
- `connection_limit=3`: caps each process's pool.
- The sync's per-user lock is `pg_advisory_xact_lock`, held only for its own
  transaction, so it works through the transaction pooler.

## On Render

**Environment → `DATABASE_URL`**: the transaction-pooler string above. Leave
`DIRECT_URL` on the session pooler: the build runs the migrations with it.

## Keep the process count low

- Only one worker should run against the database. With `RUN_WORKER=true` on
  Render, don't also run `npm run start -w @productivity/worker` on your PC
  (it stays safe, since each alert is claimed once, but it uses connections
  for nothing).
- If timeouts come back, Supabase's dashboard shows the open connections
  (Database → Roles, or the `pg_stat_activity` view).
