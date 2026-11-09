import { Module } from "@nestjs/common";

/**
 * Calendar (plan §7.2, Phase 3). Events and their per-occurrence exceptions
 * sync through /api/sync via `calendar.sync-handlers.ts`. Expanding repeats
 * happens on the clients with @productivity/domain.
 */
@Module({})
export class CalendarModule {}
