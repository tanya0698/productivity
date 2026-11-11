import React, { useEffect, useMemo, useState } from "react";
import { Alert, BackHandler, Platform, Pressable, StyleSheet, TextInput, ToastAndroid, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  editProject,
  goalProgress,
  goalStatusLabel,
  indexLogs,
  localDate,
  markReviewed,
  newGoal,
  newMilestone,
  nextReview,
  projectProgress,
  reviewDue,
  scheduleLabel,
  streak,
  toggleMilestone,
  type LocalHabit,
  type LocalHabitLog,
} from "@productivity/domain";
import { useLocalRecords, useSyncRuntime } from "@productivity/sync-engine/react";
import EmptyState from "../../../components/EmptyState";
import { Button, DateTimeButton } from "../../../components/Field";
import { Card } from "../../../components/ListCard";
import PickSheet from "../../../components/PickSheet";
import ScreenFrame from "../../../components/ScreenFrame";
import { StatRow, StatTile } from "../../../components/StatTile";
import Text from "../../../components/Text";
import { go } from "../../../navigation/ref";
import { formatDue, useProjects } from "../../../shared/projects";
import { useNow } from "../../../shared/reminders/active";
import { fonts, radii, usePalette } from "../../../theme";
import ProjectProgress from "../../projects/components/ProjectProgress";
import type { Task } from "../../tasks/components/TaskRow";
import GoalEditor from "../components/GoalEditor";
import { useGoals, type Goal } from "../components/useGoals";

type Habit = LocalHabit & { deletedAt: string | null };
type HabitLog = LocalHabitLog & { deletedAt: string | null };
type Nav = { setParams: (p: object) => void };

const toast = (m: string) => Platform.OS === "android" && ToastAndroid.show(m, ToastAndroid.SHORT);

/** Goals: progress by milestones, target date, reviews; one goal's milestones, projects and habits. */
export default function GoalsScreen() {
  const runtime = useSyncRuntime();
  const navigation = useNavigation<Nav>();
  const { goals, byId, milestonesOf, loading } = useGoals();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<Goal | null>(null);

  const route = useRoute<{ key: string; name: string; params?: { goal?: string } }>();
  const requested = route.params?.goal;
  useEffect(() => {
    if (!requested) return;
    setOpenId(requested);
    navigation.setParams({ goal: undefined });
  }, [requested, navigation]);

  const close = () => setOpenId(null);
  useEffect(() => {
    if (!openId) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [openId]);

  if (openId) {
    const goal = byId.get(openId);
    return goal ? (
      <GoalDetail key={goal.id} goal={goal} milestones={milestonesOf(goal.id)} onClose={close} />
    ) : (
      <ScreenFrame eyebrow="Goal" title={loading ? "Goal" : "Goal not found"} onBack={close}>
        {loading ? null : <EmptyState title="Not here" body="This goal was deleted, or hasn't reached this phone yet." />}
      </ScreenFrame>
    );
  }

  return (
    <>
      <GoalList goals={goals} milestonesOf={milestonesOf} loading={loading} onOpen={setOpenId} onCreate={() => setCreating(newGoal(runtime.newId(), new Date(), { title: "", reviewCadence: "monthly" }) as Goal)} />
      <GoalEditor
        goal={creating}
        isNew
        onClose={() => setCreating(null)}
        onSave={(g) => {
          void runtime.write("goal", g);
          toast("Goal added");
          setCreating(null);
          setOpenId(g.id);
        }}
      />
    </>
  );
}

function GoalList({
  goals,
  milestonesOf,
  loading,
  onOpen,
  onCreate,
}: {
  goals: Goal[];
  milestonesOf: ReturnType<typeof useGoals>["milestonesOf"];
  loading: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const p = usePalette();
  const now = useNow(60_000);
  const today = localDate(now);
  const { projects } = useProjects();
  return (
    <ScreenFrame eyebrow="Grow" title="Goals">
      <Button kind="primary" label="New goal" onPress={onCreate} />
      {!loading && !goals.length ? <EmptyState title="No goals yet" body="Pick one outcome that matters this year, then break it into milestones." /> : null}
      {goals.map((g) => {
        const progress = goalProgress(milestonesOf(g.id));
        const linked = projects.filter((x) => x.goalId === g.id).length;
        const badge =
          g.status !== "active"
            ? { text: goalStatusLabel[g.status], bg: g.status === "achieved" ? p.successSoft : p.muted, fg: g.status === "achieved" ? p.successText : p.textSecondary }
            : reviewDue(g, now)
              ? { text: "Review due", bg: p.warningSoft, fg: p.warningText }
              : null;
        return (
          <Pressable
            key={g.id}
            accessibilityRole="link"
            accessibilityLabel={`Open goal: ${g.title}`}
            onPress={() => onOpen(g.id)}
            style={({ pressed }) => [styles.card, { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.8 : g.status === "active" ? 1 : 0.75 }]}
          >
            <View style={styles.cardHead}>
              <Text weight="semiBold" numberOfLines={1} style={{ flex: 1, fontSize: 16 }}>
                {g.title}
              </Text>
              {badge ? (
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={{ fontSize: 11, color: badge.fg }}>{badge.text}</Text>
                </View>
              ) : null}
            </View>
            {g.description ? (
              <Text tone="secondary" numberOfLines={2} style={{ fontSize: 13 }}>
                {g.description}
              </Text>
            ) : null}
            <ProjectProgress progress={progress} label="Milestones done" empty="No milestones yet" />
            <View style={{ flexDirection: "row", gap: 12 }}>
              {g.targetDate ? <Text label style={{ fontSize: 10 }}>{`By · ${formatDue(g.targetDate, today)}`}</Text> : null}
              {linked ? <Text label style={{ fontSize: 10 }}>{`${linked} project${linked === 1 ? "" : "s"}`}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </ScreenFrame>
  );
}

/** One goal: why, milestones to tick, the projects and habits that serve it, and its review. */
function GoalDetail({ goal, milestones, onClose }: { goal: Goal; milestones: ReturnType<ReturnType<typeof useGoals>["milestonesOf"]>; onClose: () => void }) {
  const runtime = useSyncRuntime();
  const p = usePalette();
  const now = useNow(60_000);
  const today = localDate(now);
  const { projects } = useProjects();
  const { records: tasks } = useLocalRecords<Task>("task");
  const { records: habits } = useLocalRecords<Habit>("habit");
  const { records: logs } = useLocalRecords<HabitLog>("habit_log");
  const index = useMemo(() => indexLogs(logs), [logs]);
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState<"project" | "habit" | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<Date | null>(null);

  const progress = goalProgress(milestones);
  const linkedProjects = projects.filter((x) => x.goalId === goal.id);
  const linkedHabits = habits.filter((h) => h.goalId === goal.id && !h.archivedAt);
  const next = nextReview(goal);
  const stamp = () => new Date().toISOString();

  const addMilestone = () => {
    if (!title.trim()) return;
    const position = milestones.length ? Math.max(...milestones.map((m) => m.position)) + 1 : 0;
    void runtime.write("goal_milestone", newMilestone(runtime.newId(), new Date(), goal.id, title, position, due ? localDate(due) : null));
    setTitle("");
    setDue(null);
  };

  const remove = () =>
    Alert.alert("Delete this goal?", "Its milestones go with it; linked projects and habits stay.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const t = new Date();
          for (const m of milestones) void runtime.write("goal_milestone", m, "delete");
          for (const x of linkedProjects) void runtime.write("project", editProject(x, { goalId: null }, t));
          for (const h of linkedHabits) void runtime.write("habit", { ...h, goalId: null, updatedAt: t.toISOString() });
          void runtime.write("goal", goal, "delete");
          toast("Goal deleted");
          onClose();
        },
      },
    ]);

  const unlinkButton = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`Unlink ${label}`} hitSlop={8} onPress={onPress}>
      <Text tone="muted" style={{ fontSize: 12 }}>
        Unlink
      </Text>
    </Pressable>
  );

  return (
    <ScreenFrame eyebrow="Goal" title={goal.title} onBack={onClose}>
      {goal.description ? <Text tone="secondary">{goal.description}</Text> : null}

      {reviewDue(goal, now) ? (
        <View style={[styles.banner, { backgroundColor: p.warningSoft, borderColor: p.warning }]}>
          <Text weight="semiBold" style={{ color: p.warningText }}>
            Time to review this goal
          </Text>
          <Text style={{ color: p.warningText, fontSize: 13 }}>Is it still the right goal? What moved it on since last time, and what's the next step?</Text>
          <View style={{ marginTop: 6 }}>
            <Button small kind="primary" label="Mark reviewed" onPress={() => void runtime.write("goal", markReviewed(goal, new Date()))} />
          </View>
        </View>
      ) : null}

      <View style={[styles.tile, { backgroundColor: p.surface, borderColor: p.border }]}>
        <Text label>Progress</Text>
        <Text weight="extraBold" style={{ fontSize: 26, color: p.primary }}>{`${progress.percent}%`}</Text>
        <ProjectProgress progress={progress} label="Milestones done" empty="Add milestones to track progress" />
      </View>
      <StatRow>
        <StatTile label="Target" value={goal.targetDate ? formatDue(goal.targetDate, today) : "None"} />
        <StatTile
          label="Status"
          value={goalStatusLabel[goal.status]}
          hint={next ? `Next review ${formatDue(localDate(next), today).replace(/^(Today|Tomorrow|Yesterday)/, (w) => w.toLowerCase())}` : undefined}
        />
      </StatRow>

      <Card
        title="Milestones"
        right={
          <View style={{ flexDirection: "row", gap: 18, alignItems: "center" }}>
            <Text label>{`${progress.done}/${progress.total}`}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Edit goal" hitSlop={10} onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={20} color={p.text} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Delete goal" hitSlop={10} onPress={remove}>
              <Ionicons name="trash-outline" size={20} color={p.errorText} />
            </Pressable>
          </View>
        }
      >
        <View style={[styles.add, { backgroundColor: p.page, borderColor: p.borderStrong }]}>
          <TextInput
            accessibilityLabel="New milestone"
            placeholder="Add a milestone"
            placeholderTextColor={p.textMuted}
            value={title}
            maxLength={200}
            onChangeText={setTitle}
            onSubmitEditing={addMilestone}
            returnKeyType="done"
            style={[styles.input, { color: p.text }]}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Add milestone" onPress={addMilestone} disabled={!title.trim()} hitSlop={8}>
            <Ionicons name="add-circle" size={26} color={p.primary} style={{ opacity: title.trim() ? 1 : 0.4 }} />
          </Pressable>
        </View>
        {title.trim() ? (
          <View style={{ paddingBottom: 6 }}>
            <DateTimeButton label="Milestone date" mode="date" value={due} placeholder="By (optional)" onChange={setDue} onClear={() => setDue(null)} />
          </View>
        ) : null}
        {milestones.length ? (
          milestones.map((m, n) => {
            const late = !m.doneAt && m.dueDate && m.dueDate < today;
            return (
              <View key={m.id} style={[styles.row, { borderColor: p.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0 }]}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!m.doneAt }}
                  accessibilityLabel={m.title}
                  hitSlop={10}
                  onPress={() => void runtime.write("goal_milestone", toggleMilestone(m, new Date()))}
                >
                  <Ionicons name={m.doneAt ? "checkmark-circle" : "ellipse-outline"} size={24} color={m.doneAt ? p.success : p.borderStrong} />
                </Pressable>
                <Text style={[{ flex: 1 }, m.doneAt ? { color: p.textMuted, textDecorationLine: "line-through" } : null]}>{m.title}</Text>
                {m.dueDate ? (
                  <View style={[styles.badge, { backgroundColor: late ? p.errorSoft : p.muted }]}>
                    <Text style={{ fontSize: 11, color: late ? p.errorText : p.textSecondary }}>{formatDue(m.dueDate, today)}</Text>
                  </View>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete milestone: ${m.title}`}
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert("Delete this milestone?", m.title, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => void runtime.write("goal_milestone", m, "delete") },
                    ])
                  }
                >
                  <Ionicons name="close" size={18} color={p.textMuted} />
                </Pressable>
              </View>
            );
          })
        ) : (
          <Text tone="secondary" style={{ paddingVertical: 10 }}>
            No milestones yet. What are the 3–5 checkpoints on the way?
          </Text>
        )}
      </Card>

      <Card title="Projects" right={<LinkButton onPress={() => setLinking("project")} />}>
        {linkedProjects.length ? (
          linkedProjects.map((x, n) => {
            const pr = projectProgress(tasks.filter((t) => t.projectId === x.id));
            return (
              <View key={x.id} style={[styles.row, { borderColor: p.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0 }]}>
                <Pressable accessibilityRole="link" style={{ flex: 1 }} onPress={() => go("projects", { project: x.id })}>
                  <Text weight="medium" numberOfLines={1}>
                    {x.title}
                  </Text>
                  <Text tone="secondary" style={{ fontSize: 12 }}>
                    {pr.total ? `${pr.done}/${pr.total} tasks` : "No tasks"}
                  </Text>
                </Pressable>
                {unlinkButton(x.title, () => void runtime.write("project", editProject(x, { goalId: null }, new Date())))}
              </View>
            );
          })
        ) : (
          <Text tone="secondary" style={{ paddingBottom: 12 }}>
            No projects linked.
          </Text>
        )}
      </Card>

      <Card title="Habits" right={<LinkButton onPress={() => setLinking("habit")} />}>
        {linkedHabits.length ? (
          linkedHabits.map((h, n) => {
            const s = streak(h, index, today);
            return (
              <View key={h.id} style={[styles.row, { borderColor: p.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0 }]}>
                <Pressable accessibilityRole="link" style={{ flex: 1 }} onPress={() => go("habits")}>
                  <Text weight="medium" numberOfLines={1}>
                    {h.title}
                  </Text>
                  <Text tone="secondary" style={{ fontSize: 12 }}>
                    {`${scheduleLabel(h)}${s ? ` · 🔥 ${s}` : ""}`}
                  </Text>
                </Pressable>
                {unlinkButton(h.title, () => void runtime.write("habit", { ...h, goalId: null, updatedAt: stamp() }))}
              </View>
            );
          })
        ) : (
          <Text tone="secondary" style={{ paddingBottom: 12 }}>
            No habits linked.
          </Text>
        )}
      </Card>

      <PickSheet
        open={linking === "project"}
        title="Link a project"
        empty="No other projects."
        items={projects.filter((x) => x.goalId !== goal.id && x.status !== "archived").map((x) => ({ id: x.id, title: x.title }))}
        onClose={() => setLinking(null)}
        onPick={(id) => {
          const x = projects.find((y) => y.id === id);
          if (x) void runtime.write("project", editProject(x, { goalId: goal.id }, new Date()));
          setLinking(null);
        }}
      />
      <PickSheet
        open={linking === "habit"}
        title="Link a habit"
        empty="No other habits."
        items={habits.filter((h) => h.goalId !== goal.id && !h.archivedAt).map((h) => ({ id: h.id, title: h.title, detail: scheduleLabel(h) }))}
        onClose={() => setLinking(null)}
        onPick={(id) => {
          const h = habits.find((y) => y.id === id);
          if (h) void runtime.write("habit", { ...h, goalId: goal.id, updatedAt: stamp() });
          setLinking(null);
        }}
      />
      <GoalEditor
        goal={editing ? goal : null}
        onClose={() => setEditing(false)}
        onSave={(g) => {
          void runtime.write("goal", g);
          toast("Goal saved");
          setEditing(false);
        }}
      />
    </ScreenFrame>
  );
}

function LinkButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={onPress}>
      <Text tone="brand" weight="semiBold" style={{ fontSize: 13 }}>
        + Link
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radii.lg, padding: 14, gap: 8 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  banner: { borderWidth: 1, borderRadius: radii.lg, padding: 14, gap: 2 },
  tile: { borderWidth: 1, borderRadius: radii.lg, padding: 12, gap: 4 },
  add: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 12, marginBottom: 6 },
  input: { flex: 1, fontSize: 15, fontFamily: fonts.native.regular, paddingVertical: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
});
