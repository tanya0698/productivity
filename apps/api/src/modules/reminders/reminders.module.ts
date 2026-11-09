import { Module } from "@nestjs/common";

/**
 * Reminders (plan §8). Synced through /api/sync via `reminders.sync-handler.ts`.
 * When they fire is decided by @productivity/domain on each client; the worker
 * that sends web push (plan §8.1) uses the same rules when it arrives.
 */
@Module({})
export class RemindersModule {}
