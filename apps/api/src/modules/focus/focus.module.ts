import { Module } from "@nestjs/common";

/**
 * Focus (plan Phase 5). Records sync through /api/sync via this folder's
 * sync handler(s); the rules (streaks, timers, progress) live in
 * @productivity/domain so every client computes them the same way.
 */
@Module({})
export class FocusModule {}
