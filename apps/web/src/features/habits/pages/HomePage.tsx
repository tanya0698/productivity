import { useState } from "react";
import { App as AntApp, Button, Card, Col, Collapse, Flex, Row } from "antd";
import { CheckCircleOutlined, FireOutlined, PlusOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { STREAK_TARGET, habitProgress, isScheduled, localDate, newHabit, percentOf, streak } from "@productivity/domain";
import { ModulePage, useNow, useSyncRuntime, useDataReady } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListCardSkeleton, TileRowSkeleton } from "@/components/ui/Skeletons";
import { StatTile } from "@/components/ui/StatTile";
import { HabitEditor } from "../components/HabitEditor";
import { HabitRow } from "../components/HabitRow";
import { useHabits, type Habit } from "../components/useHabits";

/**
 * Habits: today's ones to tick off, the rest of the week's, streaks and the
 * last seven days. Ticks are saved on this device first and synced.
 */
export default function HomePage() {
  const runtime = useSyncRuntime();
  const { message } = AntApp.useApp();
  const now = useNow(60_000);
  const today = localDate(now);
  const { habits, archived, logs, index, loading, tick, untick } = useHabits();
  const ready = useDataReady(loading);
  const [editing, setEditing] = useState<{ habit: Habit; isNew: boolean } | null>(null);

  const dueToday = habits.filter((h) => isScheduled(h, today));
  const notToday = habits.filter((h) => !isScheduled(h, today));
  const doneToday = dueToday.filter((h) => habitProgress(h, index, today).done).length;
  const best = habits.reduce((m, h) => Math.max(m, streak(h, index, today)), 0);

  const row = (h: Habit) => (
    <HabitRow
      key={h.id}
      habit={h}
      index={index}
      today={today}
      onTick={(x) => void tick(x)}
      onUntick={(x) => void untick(x)}
      onOpen={(x) => setEditing({ habit: x, isNew: false })}
    />
  );

  return (
    <ModulePage
      eyebrow="Grow"
      title="Habits"
      description="Small things, done often. Tick them off as you go; streaks count the days in a row."
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ habit: newHabit(runtime.newId(), new Date(), { title: "" }), isNew: true })}>
          New habit
        </Button>
      }
    >
      {habits.length ? (
        <Row gutter={[16, 16]}>
          <Col xs={12} md={8}>
            <StatTile
              icon={<CheckCircleOutlined />}
              iconTone="success"
              label="Done today"
              subtitle={`${dueToday.length} due`}
              value={`${doneToday}/${dueToday.length}`}
              ring={{ percent: dueToday.length ? Math.round((doneToday / dueToday.length) * 100) : null, label: "Today" }}
            />
          </Col>
          <Col xs={12} md={8}>
            <StatTile icon={<FireOutlined />} iconTone="warning" label="Best streak" ring={{ percent: percentOf(best, STREAK_TARGET), label: "30-Day Goal" }} subtitle="In a row" value={best} hint={best === 1 ? "day or week" : "days or weeks"} />
          </Col>
          <Col xs={24} md={8}>
            <StatTile
              icon={<UnorderedListOutlined />}
              iconTone="accent"
              label="Habits"
              ring={{ percent: percentOf(habits.filter((h) => streak(h, index, today) > 0).length, habits.length), label: "On A Streak" }}
              subtitle="Active"
              value={habits.length}
              hint={`${habits.filter((h) => h.cadence === "weekly").length} weekly · ${habits.filter((h) => h.cadence === "daily").length} daily`}
              tone="neutral"
            />
          </Col>
        </Row>
      ) : null}

      {!ready && !habits.length ? (
        <>
          <TileRowSkeleton />
          <ListCardSkeleton rows={4} />
        </>
      ) : null}

      {ready && !habits.length ? (
        <Card className="pp-card">
          <EmptyState text="No habits yet. Start with one small thing you want to do most days." />
        </Card>
      ) : null}

      {dueToday.length ? (
        <Card className="pp-card" title="Today" extra={<span className="pp-label pp-num">{dueToday.length}</span>}>
          <Flex vertical>{dueToday.map(row)}</Flex>
        </Card>
      ) : null}
      {notToday.length ? (
        <Card className="pp-card" title="Not due today" extra={<span className="pp-label pp-num">{notToday.length}</span>}>
          <Flex vertical>{notToday.map(row)}</Flex>
        </Card>
      ) : null}

      {archived.length ? (
        <Collapse
          ghost
          items={[
            {
              key: "archived",
              label: <span className="pp-label">Archived · {archived.length}</span>,
              children: (
                <Flex vertical gap={6}>
                  {archived.map((h) => (
                    <Flex key={h.id} justify="space-between" align="center">
                      <span>{h.title}</span>
                      <Button size="small" onClick={() => void runtime.write("habit", { ...h, archivedAt: null, updatedAt: new Date().toISOString() })}>
                        Restore
                      </Button>
                    </Flex>
                  ))}
                </Flex>
              ),
            },
          ]}
        />
      ) : null}

      <HabitEditor
        habit={editing?.habit ?? null}
        isNew={editing?.isNew}
        onClose={() => setEditing(null)}
        onSave={(h) => {
          void runtime.write("habit", h);
          void message.success(editing?.isNew ? "Habit added" : "Habit saved");
          setEditing(null);
        }}
        onArchive={(h) => {
          void runtime.write("habit", { ...h, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
          void message.success("Habit archived");
          setEditing(null);
        }}
        onDelete={(h) => {
          // Its logs go too, so nothing is left pointing at it.
          for (const l of logs.filter((l) => l.habitId === h.id)) void runtime.write("habit_log", l, "delete");
          void runtime.write("habit", h, "delete");
          void message.success("Habit deleted");
          setEditing(null);
        }}
      />
    </ModulePage>
  );
}
