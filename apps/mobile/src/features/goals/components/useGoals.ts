import { useMemo } from "react";
import { sortGoals, sortMilestones, type LocalGoal, type LocalMilestone } from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";

export type Goal = LocalGoal & { deletedAt: string | null };
export type Milestone = LocalMilestone & { deletedAt: string | null };

/** Goals (sorted) and each goal's milestones (in order). */
export function useGoals() {
  const { records: goals, loading } = useLocalRecords<Goal>("goal");
  const { records: milestones } = useLocalRecords<Milestone>("goal_milestone");
  const sorted = useMemo(() => sortGoals(goals), [goals]);
  const byGoal = useMemo(() => {
    const m = new Map<string, Milestone[]>();
    for (const x of milestones) m.set(x.goalId, [...(m.get(x.goalId) ?? []), x]);
    for (const [k, v] of m) m.set(k, sortMilestones(v));
    return m;
  }, [milestones]);
  return { goals: sorted, byId: new Map(sorted.map((g) => [g.id, g])), milestonesOf: (id: string) => byGoal.get(id) ?? [], loading };
}
