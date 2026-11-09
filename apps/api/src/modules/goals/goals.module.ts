import { Module } from "@nestjs/common";

/**
 * Goals (plan Phase 5). Records sync through /api/sync via this folder's
 * sync handler(s); the rules (streaks, timers, progress) live in
 * @productivity/domain so every client computes them the same way.
 */
@Module({})
export class GoalsModule {}
