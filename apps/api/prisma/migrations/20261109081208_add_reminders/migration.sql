-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "task_id" UUID,
    "note_id" UUID,
    "title" TEXT,
    "remind_at" TIMESTAMPTZ NOT NULL,
    "timezone" TEXT NOT NULL,
    "recurrence_rule" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "snoozed_until" TIMESTAMPTZ,
    "last_handled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "version" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id"),
    -- Added by hand (plan §7.2): linked to at most one thing; none = standalone.
    CONSTRAINT "reminders_one_link" CHECK (num_nonnulls("task_id", "note_id") <= 1),
    CONSTRAINT "reminders_status" CHECK ("status" IN ('scheduled', 'snoozed', 'dismissed', 'done'))
);
-- CreateIndex
CREATE INDEX "reminders_user_id_updated_at_idx" ON "reminders"("user_id", "updated_at");
-- CreateIndex
CREATE INDEX "reminders_user_id_remind_at_idx" ON "reminders"("user_id", "remind_at");
-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
