# ADR 0001: Sync protocol

**Status:** Proposed
**Date:** 2026-10-21

## Context

Clients write to a local database first and sync later (plan §6). The server needs an ordering that clients can resume from after being offline, and retried requests must not apply twice.

## Decision (proposed, implemented in the scaffold)

- **Cursor:** every accepted change gets a row in `sync_changes` with a `BIGSERIAL change_seq`, written in the same transaction as the change. Clients pull with `?cursor=<change_seq>`. `updated_at` is never a cursor.
- **Commit order:** writes take `pg_advisory_xact_lock(hashtext(user_id))`, so one user's sequence values commit in order and a puller can't skip a gap. Acceptable for one user; revisit if many users share the database.
- **Idempotency:** `UNIQUE (user_id, operation_id)`. A repeated operation is acknowledged with its original version and not re-applied.
- **Conflicts:** optimistic, on `version`. A push whose `baseVersion` differs from the server's returns `conflict` with the server record. The client keeps both and shows the conflict screen (plan §6.5).
- **Pull payload:** each entity's current state once, at its latest change in the page.

Code: `apps/api/src/sync/`, `packages/sync-engine/`, `packages/contracts` (sync section).

## Open questions

- Per-entity merge rules for tasks (field-level) and note bodies (keep both vs CRDT).
- Tombstone purge window (plan §6.5 suggests 90 days).
- When devices are registered, set `origin_device_id` and skip echoing a device's own changes back to it.
