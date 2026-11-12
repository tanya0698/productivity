import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  FOCUS_PRESETS,
  clock,
  elapsedMs,
  focusStats,
  focusTrend,
  percentOf,
  FOCUS_DAY_TARGET_MIN,
  FOCUS_WEEK_TARGET_MIN,
  groupTasks,
  localDate,
  minutesText,
  remainingMs,
  type LocalFocusSession,
} from "@productivity/domain";
import { useLocalRecords, useSyncRuntime } from "@productivity/sync-engine/react";
import { Button, Chips, Input } from "../../../components/Field";
import { Card } from "../../../components/ListCard";
import { RowsSkeleton } from "../../../components/Skeleton";
import { useDataReady } from "../../../shared/data/useDataReady";
import ScreenFrame from "../../../components/ScreenFrame";
import Sheet from "../../../components/Sheet";
import { StatRow, StatTile } from "../../../components/StatTile";
import Text from "../../../components/Text";
import { useFocus, useTicking } from "../../../shared/focus/FocusProvider";
import { useNow } from "../../../shared/reminders/active";
import { radii, usePalette } from "../../../theme";
import type { Task } from "../../tasks/components/TaskRow";

type Session = LocalFocusSession & { deletedAt: string | null };
const PRESET_KEY = "focus.preset";

/**
 * Focus: a timer for one stretch of work (optionally on a task), then a
 * break. Only finished sessions are saved and synced; the timer keeps going
 * with the app closed, and the phone alerts when it's up.
 */
export default function FocusScreen() {
  const runtime = useSyncRuntime();
  const p = usePalette();
  const { timer, finished, start, pause, resume, stop, dismissFinished } = useFocus();
  const now = useTicking(!!timer?.runningSince);
  const today = useNow(60_000);
  const { records: sessions, loading: sessionsLoading } = useLocalRecords<Session>("focus_session");
  const ready = useDataReady(sessionsLoading);
  const { records: tasks } = useLocalRecords<Task>("task");
  const [preset, setPreset] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  // The preset is remembered on this phone.
  useEffect(() => {
    void runtime.db.getMeta(PRESET_KEY).then((v) => {
      const i = Number(v);
      if (Number.isInteger(i) && i >= 0 && i < FOCUS_PRESETS.length) setPreset(i);
    });
  }, [runtime]);
  const choosePreset = (i: number) => {
    setPreset(i);
    void runtime.db.setMeta(PRESET_KEY, String(i));
  };

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const stats = focusStats(sessions, today);
  const recent = useMemo(() => sessions.filter((s) => s.kind === "focus").sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 12), [sessions]);
  const { focus: focusMin, rest } = FOCUS_PRESETS[preset]!;

  const total = timer ? timer.plannedMinutes * 60_000 : focusMin * 60_000;
  const left = timer ? remainingMs(timer, now) : total;
  const fraction = timer ? Math.min(1, elapsedMs(timer, now) / total) : 0;
  const linkedTask = timer?.taskId ? taskById.get(timer.taskId) : undefined;
  const chosen = taskId ? taskById.get(taskId) : undefined;
  const begin = () => start("focus", focusMin, { taskId, projectId: chosen?.projectId ?? null });

  return (
    <ScreenFrame eyebrow="Grow" title="Focus">
      {finished && !timer ? (
        <View style={[styles.banner, { backgroundColor: p.successSoft, borderColor: p.success }]}>
          <Text weight="semiBold" style={{ color: p.successText }}>
            {finished.kind === "focus" ? `${finished.minutes} minutes of focus done.` : "Break over."}
          </Text>
          <Text style={{ color: p.successText, fontSize: 13 }}>
            {finished.kind === "focus" ? `Take a ${rest}-minute break before the next one.` : "Ready for another session?"}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              {finished.kind === "focus" ? (
                <Button small kind="primary" label={`Start ${rest}-min break`} onPress={() => start("break", rest)} />
              ) : (
                <Button small kind="primary" label="Start focus" onPress={begin} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Button small label={finished.kind === "focus" ? "Skip break" : "Not now"} onPress={dismissFinished} />
            </View>
          </View>
        </View>
      ) : null}

      <View style={[styles.timerCard, { backgroundColor: p.surface, borderColor: p.cardBorder }]}>
        <Text label tone="brand">
          {timer ? (timer.kind === "focus" ? "Focus" : "Break") : "Ready"}
        </Text>
        <Ring fraction={fraction} color={timer?.kind === "break" ? p.accent : p.primary} track={p.muted}>
          <Text weight="extraBold" tone="heading" accessibilityRole="timer" accessibilityLabel={`${clock(left)} left`} style={styles.clock}>
            {clock(left)}
          </Text>
          <Text tone="secondary" style={{ fontSize: 12 }}>
            {timer ? (timer.runningSince ? `of ${timer.plannedMinutes} min` : "Paused") : `${focusMin} min focus · ${rest} min break`}
          </Text>
        </Ring>

        {timer ? (
          <View style={{ alignSelf: "stretch", gap: 10 }}>
            {linkedTask ? (
              <Text tone="secondary" style={{ textAlign: "center" }}>
                On: <Text weight="semiBold">{linkedTask.title}</Text>
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                {timer.runningSince ? <Button label="Pause" onPress={pause} /> : <Button kind="primary" label="Resume" onPress={resume} />}
              </View>
              <View style={{ flex: 1 }}>
                <Button label={timer.kind === "focus" ? "Stop" : "End break"} onPress={stop} />
              </View>
            </View>
            {timer.kind === "focus" ? (
              <Text tone="muted" style={{ fontSize: 12, textAlign: "center" }}>
                Stopping early still saves the time, if it was at least a minute.
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={{ alignSelf: "stretch", gap: 12 }}>
            <Chips value={String(preset)} options={FOCUS_PRESETS.map((x, i) => ({ value: String(i), label: x.label }))} onChange={(v) => choosePreset(Number(v))} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={chosen ? `Working on ${chosen.title}. Tap to change.` : "Choose a task (optional)"}
              onPress={() => setPicking(true)}
              style={[styles.pick, { borderColor: p.borderStrong, backgroundColor: p.page }]}
            >
              <Ionicons name="checkbox-outline" size={18} color={p.textSecondary} />
              <Text numberOfLines={1} style={{ flex: 1, color: chosen ? p.text : p.textMuted }}>
                {chosen ? chosen.title : "Working on a task? (optional)"}
              </Text>
              {chosen ? (
                <Pressable accessibilityRole="button" accessibilityLabel="No task" hitSlop={10} onPress={() => setTaskId(null)}>
                  <Ionicons name="close-circle" size={18} color={p.textMuted} />
                </Pressable>
              ) : (
                <Ionicons name="chevron-down" size={16} color={p.textMuted} />
              )}
            </Pressable>
            <Button kind="primary" label="Start focus" onPress={begin} />
          </View>
        )}
      </View>

      <StatRow>
        <StatTile
          icon="time"
          label="Today"
          ring={{ percent: percentOf(Math.round(stats.todaySeconds / 60), FOCUS_DAY_TARGET_MIN), label: "Of 2 H" }}
          subtitle="Focus time"
          value={minutesText(stats.todaySeconds)}
          hint={`${stats.sessionsToday} session${stats.sessionsToday === 1 ? "" : "s"}`}
          trend={{ ...focusTrend(sessions, localDate(today), 1), period: "vs yesterday" }}
        />
        <StatTile
          icon="calendar"
          iconTone="accent"
          label="This week"
          ring={{ percent: percentOf(Math.round(stats.weekSeconds / 60), FOCUS_WEEK_TARGET_MIN), label: "Of 10 H" }}
          subtitle="Since Monday"
          value={minutesText(stats.weekSeconds)}
          hint={`${minutesText(focusTrend(sessions, localDate(today)).now * 60)} in the last 7 days`}
          trend={{ ...focusTrend(sessions, localDate(today)) }}
        />
      </StatRow>

      <Card title="Recent sessions">
        {recent.length ? (
          recent.map((s, n) => (
            <View key={s.id} style={[styles.session, { borderColor: p.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0 }]}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1}>{(s.taskId && taskById.get(s.taskId)?.title) || "Focus"}</Text>
                <Text tone="muted" style={{ fontSize: 12 }}>
                  {new Date(s.startedAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: s.completed ? p.successSoft : p.muted }]}>
                <Text style={{ fontSize: 12, color: s.completed ? p.successText : p.textSecondary }}>
                  {`${minutesText(s.durationSeconds)}${s.completed ? "" : " · stopped"}`}
                </Text>
              </View>
            </View>
          ))
        ) : !ready ? (
          <RowsSkeleton rows={3} check={false} />
        ) : (
          <Text tone="secondary" style={{ paddingBottom: 12 }}>
            No sessions yet. Your finished sessions show up here.
          </Text>
        )}
      </Card>

      <TaskPicker open={picking} tasks={tasks} onClose={() => setPicking(false)} onPick={(id) => (setTaskId(id), setPicking(false))} />
    </ScreenFrame>
  );
}

/** A ring of 60 ticks, filled clockwise from the top as the time runs (no SVG needed). */
function Ring({ fraction, color, track, children }: { fraction: number; color: string; track: string; children: React.ReactNode }) {
  const size = 240;
  const r = 110;
  const ticks = 60;
  const lit = Math.round(fraction * ticks);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: ticks }, (_, i) => {
        const a = (i / ticks) * 2 * Math.PI;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              width: 4,
              height: 14,
              borderRadius: 2,
              backgroundColor: i < lit ? color : track,
              left: size / 2 - 2 + r * Math.sin(a),
              top: size / 2 - 7 - r * Math.cos(a),
              transform: [{ rotate: `${(i / ticks) * 360}deg` }],
            }}
          />
        );
      })}
      <View style={{ alignItems: "center", gap: 2 }}>{children}</View>
    </View>
  );
}

function TaskPicker({ open, tasks, onClose, onPick }: { open: boolean; tasks: Task[]; onClose: () => void; onPick: (id: string) => void }) {
  const p = usePalette();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const g = groupTasks(tasks, new Date(), localDate(new Date()));
    const open = [...g.overdue, ...g.today, ...g.upcoming, ...g.someday];
    const needle = q.trim().toLowerCase();
    return (needle ? open.filter((t) => t.title.toLowerCase().includes(needle)) : open).slice(0, 40);
  }, [tasks, q]);
  return (
    <Sheet open={open} title="Working on" onClose={onClose}>
      <Input accessibilityLabel="Search tasks" value={q} onChangeText={setQ} placeholder="Search open tasks" />
      {list.length ? (
        list.map((t, n) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            onPress={() => onPick(t.id)}
            style={({ pressed }) => [styles.session, { borderColor: p.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text numberOfLines={2} style={{ flex: 1 }}>
              {t.title}
            </Text>
          </Pressable>
        ))
      ) : (
        <Text tone="secondary">{q ? "No open task matches." : "No open tasks."}</Text>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: radii.lg, padding: 14, gap: 2 },
  timerCard: { borderWidth: 1, borderRadius: radii.lg, padding: 16, alignItems: "center", gap: 16 },
  clock: { fontSize: 52, letterSpacing: -1.5, fontVariant: ["tabular-nums"] },
  pick: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 12 },
  session: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 },
});
