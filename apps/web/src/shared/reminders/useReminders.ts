import type { LocalReminder } from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";

export type Reminder = LocalReminder & { deletedAt: string | null };

/** All of the user's reminders on this device (live and finished; never deleted ones). */
export function useReminders() {
  return useLocalRecords<Reminder>("reminder");
}

/** This device's IANA timezone, e.g. "Africa/Harare": repeats keep their time in it. */
export const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
