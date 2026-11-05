import { Module } from "@nestjs/common";

/**
 * Tasks (plan §11.6). Synced through /api/sync via `tasks.sync-handler.ts`.
 * Task rules (status transitions, due state) live in @productivity/domain so
 * the clients apply exactly the same ones.
 */
@Module({})
export class TasksModule {}
