-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "event_id" UUID;
-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "project_id" UUID,
    "task_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "local_start" TIMESTAMP(0),
    "local_end" TIMESTAMP(0),
    "timezone" TEXT,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "start_date" DATE,
    "end_date" DATE,
    "recurrence_rule" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "version" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "calendar_event_exceptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "original_occurrence" TIMESTAMP(0) NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "override_local_start" TIMESTAMP(0),
    "override_local_end" TIMESTAMP(0),
    "override_title" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "version" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "calendar_event_exceptions_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "calendar_events_user_id_updated_at_idx" ON "calendar_events"("user_id", "updated_at");
-- CreateIndex
CREATE INDEX "calendar_events_user_id_starts_at_idx" ON "calendar_events"("user_id", "starts_at");
-- CreateIndex
CREATE INDEX "calendar_events_user_id_start_date_idx" ON "calendar_events"("user_id", "start_date");
-- CreateIndex
CREATE INDEX "calendar_event_exceptions_user_id_updated_at_idx" ON "calendar_event_exceptions"("user_id", "updated_at");
-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_exceptions_event_id_original_occurrence_key" ON "calendar_event_exceptions"("event_id", "original_occurrence");
-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "calendar_event_exceptions" ADD CONSTRAINT "calendar_event_exceptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "calendar_event_exceptions" ADD CONSTRAINT "calendar_event_exceptions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Added by hand (plan §7.2): an event is either all-day (dates, end after
-- start) or timed (wall-clock + zone, end after start), never a mix.
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_shape" CHECK (
  ("all_day" AND "start_date" IS NOT NULL AND "end_date" > "start_date")
  OR (NOT "all_day" AND "local_start" IS NOT NULL AND "local_end" IS NOT NULL
      AND "timezone" IS NOT NULL AND "starts_at" IS NOT NULL AND "ends_at" > "starts_at")
);
-- A reminder links to at most one task, note or event (none = standalone).
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_one_link";
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_one_link" CHECK (num_nonnulls("task_id", "note_id", "event_id") <= 1);
