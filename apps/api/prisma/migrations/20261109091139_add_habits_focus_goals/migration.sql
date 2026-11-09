-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "goal_id" UUID;
-- CreateTable
CREATE TABLE "habits" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cadence" TEXT NOT NULL DEFAULT 'daily',
    "days_of_week" SMALLINT[],
    "target_count" SMALLINT NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "version" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "habit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "habit_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "count" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "version" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "habit_logs_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "focus_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "task_id" UUID,
    "project_id" UUID,
    "kind" TEXT NOT NULL DEFAULT 'focus',
    "started_at" TIMESTAMPTZ NOT NULL,
    "ended_at" TIMESTAMPTZ NOT NULL,
    "planned_minutes" SMALLINT NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "version" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "focus_sessions_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "target_date" DATE,
    "review_cadence" TEXT,
    "last_reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "version" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "goal_milestones" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "due_date" DATE,
    "done_at" TIMESTAMPTZ,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "version" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "goal_milestones_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "habits_user_id_updated_at_idx" ON "habits"("user_id", "updated_at");
-- CreateIndex
CREATE INDEX "habit_logs_user_id_updated_at_idx" ON "habit_logs"("user_id", "updated_at");
-- CreateIndex
CREATE INDEX "habit_logs_habit_id_date_idx" ON "habit_logs"("habit_id", "date");
-- CreateIndex
CREATE INDEX "focus_sessions_user_id_updated_at_idx" ON "focus_sessions"("user_id", "updated_at");
-- CreateIndex
CREATE INDEX "focus_sessions_user_id_started_at_idx" ON "focus_sessions"("user_id", "started_at");
-- CreateIndex
CREATE INDEX "goals_user_id_updated_at_idx" ON "goals"("user_id", "updated_at");
-- CreateIndex
CREATE INDEX "goal_milestones_user_id_updated_at_idx" ON "goal_milestones"("user_id", "updated_at");
-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "habits" ADD CONSTRAINT "habits_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Added by hand: the same rules as @productivity/contracts, so bad rows can't land.
ALTER TABLE "habits" ADD CONSTRAINT "habits_shape" CHECK (
  "cadence" IN ('daily', 'weekly') AND "target_count" BETWEEN 1 AND 100
  AND "days_of_week" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::SMALLINT[]
);
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_count" CHECK ("count" BETWEEN 1 AND 100);
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_shape" CHECK (
  "kind" IN ('focus', 'break') AND "duration_seconds" >= 0 AND "ended_at" >= "started_at" AND "planned_minutes" > 0
);
ALTER TABLE "goals" ADD CONSTRAINT "goals_shape" CHECK (
  "status" IN ('active', 'achieved', 'dropped') AND ("review_cadence" IS NULL OR "review_cadence" IN ('weekly', 'monthly'))
);
