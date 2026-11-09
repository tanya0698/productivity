import type { Goal, GoalMilestone } from "@productivity/contracts";

/**
 * Goal rules (plan Phase 5): progress from milestones, ordering, and when a
 * goal is due for its weekly or monthly review.
 */

export type LocalGoal = Omit<Goal, "userId"> & { userId?: string };
export type LocalMilestone = Omit<GoalMilestone, "userId"> & { userId?: string };

export const goalStatusLabel: Record<LocalGoal["status"], string> = {
  active: "Active",
  achieved: "Achieved",
  dropped: "Dropped",
};

export interface GoalFields {
  title: string;
  description?: string | null;
  targetDate?: string | null;
  reviewCadence?: LocalGoal["reviewCadence"];
}

export function newGoal(id: string, now: Date, f: GoalFields): LocalGoal {
  const at = now.toISOString();
  return {
    id,
    createdAt: at,
    updatedAt: at,
    version: 0,
    deletedAt: null,
    title: f.title.trim(),
    description: f.description?.trim() || null,
    status: "active",
    targetDate: f.targetDate ?? null,
    reviewCadence: f.reviewCadence ?? null,
    lastReviewedAt: null,
  };
}

export function editGoal<T extends LocalGoal>(g: T, f: Partial<GoalFields> & { status?: LocalGoal["status"] }, now: Date): T {
  return {
    ...g,
    ...f,
    title: f.title === undefined ? g.title : f.title.trim() || g.title,
    description: f.description === undefined ? g.description : f.description?.trim() || null,
    updatedAt: now.toISOString(),
  };
}

export const markReviewed = <T extends LocalGoal>(g: T, now: Date): T => ({ ...g, lastReviewedAt: now.toISOString(), updatedAt: now.toISOString() });

/** When the next review is due, or null for no cadence or a finished goal. Counted from the last review (or creation). */
export function nextReview(g: LocalGoal): Date | null {
  if (!g.reviewCadence || g.status !== "active") return null;
  const from = new Date(g.lastReviewedAt ?? g.createdAt);
  const next = new Date(from);
  if (g.reviewCadence === "weekly") next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

export const reviewDue = (g: LocalGoal, now: Date) => {
  const next = nextReview(g);
  return !!next && next.getTime() <= now.getTime();
};

export function newMilestone(id: string, now: Date, goalId: string, title: string, position: number, dueDate: string | null = null): LocalMilestone {
  const at = now.toISOString();
  return { id, createdAt: at, updatedAt: at, version: 0, deletedAt: null, goalId, title: title.trim(), dueDate, doneAt: null, position };
}

export const toggleMilestone = <T extends LocalMilestone>(m: T, now: Date): T => ({
  ...m,
  doneAt: m.doneAt ? null : now.toISOString(),
  updatedAt: now.toISOString(),
});

export const sortMilestones = <T extends Pick<LocalMilestone, "position" | "createdAt">>(ms: readonly T[]): T[] =>
  [...ms].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));

/** Done milestones out of all; 100% only when every one is done. */
export function goalProgress(milestones: readonly Pick<LocalMilestone, "doneAt">[]) {
  const done = milestones.filter((m) => m.doneAt).length;
  return { done, total: milestones.length, percent: milestones.length ? Math.floor((done / milestones.length) * 100) : 0 };
}

const GOAL_ORDER: Record<LocalGoal["status"], number> = { active: 0, achieved: 1, dropped: 2 };

/** Active first; then soonest target date; then by name. */
export const sortGoals = <T extends Pick<LocalGoal, "status" | "targetDate" | "title">>(gs: readonly T[]): T[] =>
  [...gs].sort(
    (a, b) =>
      GOAL_ORDER[a.status] - GOAL_ORDER[b.status] ||
      (a.targetDate ?? "9999-12-31").localeCompare(b.targetDate ?? "9999-12-31") ||
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );
