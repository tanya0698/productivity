import {
  calendarEventObject,
  calendarEventShape,
  eventExceptionObject,
  focusSession,
  goal,
  goalMilestone,
  habit,
  habitLog,
  note,
  project,
  reminderObject,
  task,
  type EntityType,
} from "@productivity/contracts";

/**
 * JSON backups (plan: export/import). A backup holds every live record by
 * type. Importing never overwrites: records already on this device are
 * skipped, everything else is created with a fresh id and its links rewritten,
 * so a backup can also go into another account without colliding with the
 * original records on the server.
 */

export const BACKUP_FORMAT = "productivity-backup";
export const BACKUP_VERSION = 1;

/** Parents before children, so links resolve in order. */
export const BACKUP_ORDER = [
  "goal",
  "project",
  "task",
  "note",
  "habit",
  "event",
  "reminder",
  "habit_log",
  "goal_milestone",
  "event_exception",
  "focus_session",
] as const satisfies readonly EntityType[];

export type BackupEntity = (typeof BACKUP_ORDER)[number];
export type BackupRecord = Record<string, unknown> & { id: string };

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Partial<Record<BackupEntity, BackupRecord[]>>;
}

export const backupLabel: Record<BackupEntity, string> = {
  project: "projects",
  goal: "goals",
  task: "tasks",
  note: "notes",
  habit: "habits",
  event: "events",
  reminder: "reminders",
  habit_log: "habit check-ins",
  goal_milestone: "milestones",
  event_exception: "event changes",
  focus_session: "focus sessions",
};

const omitUser = { userId: true } as const;
/** The one thing used from each contract schema. */
type Validator = { safeParse(value: unknown): { success: boolean; data?: unknown } };
const schemas: Record<BackupEntity, Validator> = {
  project: project.omit(omitUser),
  goal: goal.omit(omitUser),
  task: task.omit(omitUser),
  note: note.omit(omitUser),
  habit: habit.omit(omitUser),
  event: calendarEventObject.omit(omitUser),
  reminder: reminderObject.omit(omitUser),
  habit_log: habitLog.omit(omitUser),
  goal_milestone: goalMilestone.omit(omitUser),
  event_exception: eventExceptionObject.omit(omitUser),
  focus_session: focusSession.omit(omitUser),
};

/** Which fields point at which kind of record. `required` children are skipped without their parent. */
const links: Partial<Record<BackupEntity, { field: string; to: BackupEntity; required?: boolean }[]>> = {
  project: [{ field: "goalId", to: "goal" }],
  task: [
    { field: "projectId", to: "project" },
    { field: "parentTaskId", to: "task" },
  ],
  note: [{ field: "projectId", to: "project" }],
  habit: [{ field: "goalId", to: "goal" }],
  event: [
    { field: "projectId", to: "project" },
    { field: "taskId", to: "task" },
  ],
  reminder: [
    { field: "taskId", to: "task" },
    { field: "noteId", to: "note" },
    { field: "eventId", to: "event" },
  ],
  habit_log: [{ field: "habitId", to: "habit", required: true }],
  goal_milestone: [{ field: "goalId", to: "goal", required: true }],
  event_exception: [{ field: "eventId", to: "event", required: true }],
  focus_session: [
    { field: "taskId", to: "task" },
    { field: "projectId", to: "project" },
  ],
};

/** A backup of these records: live ones only, without the owner (the server sets it). */
export function buildBackup(records: Partial<Record<BackupEntity, readonly Record<string, unknown>[]>>, now: Date): Backup {
  const data: Backup["data"] = {};
  for (const entity of BACKUP_ORDER) {
    const list = (records[entity] ?? []).filter((r) => !r.deletedAt);
    data[entity] = list.map(({ userId: _owner, ...rest }) => rest as BackupRecord);
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

export const backupCounts = (b: Pick<Backup, "data">) =>
  BACKUP_ORDER.map((e) => ({ entity: e, count: b.data[e]?.length ?? 0 })).filter((c) => c.count);

/** Read a backup file's text, or say plainly why it isn't one. */
export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't valid JSON." };
  }
  const b = json as Partial<Backup> | null;
  if (!b || typeof b !== "object" || b.format !== BACKUP_FORMAT || typeof b.data !== "object" || !b.data) {
    return { ok: false, error: "This isn't a Creedence backup file." };
  }
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION) {
    return { ok: false, error: "This backup was made by a newer version of the app. Update the app, then try again." };
  }
  return { ok: true, backup: b as Backup };
}

export interface ImportPlan {
  /** In write order, parents first, with fresh ids and links rewritten. */
  writes: { entity: BackupEntity; record: Record<string, unknown> }[];
  /** Per type: new, already here (skipped), invalid, or missing their parent. */
  summary: { entity: BackupEntity; added: number; existing: number; invalid: number; orphaned: number }[];
}

/**
 * What importing `backup` would write. `exists(entity, id)` says whether this
 * device already has that record (deleted ones included, so a deliberate
 * delete isn't undone).
 */
export function planImport(
  backup: Backup,
  exists: (entity: BackupEntity, id: string) => boolean,
  newId: () => string,
  now: Date,
): ImportPlan {
  // Old id → the id it has after import (itself if already here).
  const ids = new Map<string, string>();
  const writes: ImportPlan["writes"] = [];
  const summary: ImportPlan["summary"] = [];
  const at = now.toISOString();

  for (const entity of BACKUP_ORDER) {
    const row = { entity, added: 0, existing: 0, invalid: 0, orphaned: 0 };
    for (const raw of backup.data[entity] ?? []) {
      if (!raw || typeof raw !== "object" || typeof raw.id !== "string") {
        row.invalid++;
        continue;
      }
      if (exists(entity, raw.id)) {
        ids.set(`${entity}:${raw.id}`, raw.id);
        row.existing++;
        continue;
      }
      const record: Record<string, unknown> = { ...raw, id: newId(), version: 0, deletedAt: null, updatedAt: at };
      delete record.userId;
      let orphan = false;
      for (const link of links[entity] ?? []) {
        const old = record[link.field];
        if (typeof old !== "string") continue;
        const mapped = ids.get(`${link.to}:${old}`) ?? (exists(link.to, old) ? old : undefined);
        if (mapped) record[link.field] = mapped;
        else if (link.required) orphan = true;
        else record[link.field] = null;
      }
      if (orphan) {
        row.orphaned++;
        continue;
      }
      const parsed = schemas[entity].safeParse(record);
      if (!parsed.success || (entity === "event" && !calendarEventShape(parsed.data as never))) {
        row.invalid++;
        continue;
      }
      ids.set(`${entity}:${raw.id}`, record.id as string);
      writes.push({ entity, record });
      row.added++;
    }
    if (row.added || row.existing || row.invalid || row.orphaned) summary.push(row);
  }
  return { writes, summary };
}
