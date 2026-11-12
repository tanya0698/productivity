import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, App as AntApp, Button, Card, Checkbox, Col, DatePicker, Flex, Input, Popconfirm, Row, Select, Typography } from "antd";
import { AimOutlined, ArrowLeftOutlined, DeleteOutlined, EditOutlined, FireOutlined, FlagOutlined, PieChartOutlined, PlusOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import {
  goalCardStats,
  reviewCycleUsed,
  timeUsed,
  editProject,
  goalProgress,
  goalStatusLabel,
  indexLogs,
  localDate,
  markReviewed,
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
import { ModulePage, formatDue, useLocalRecords, useNow, useProjects, useSyncRuntime, type Task, useDataReady } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSkeleton } from "@/components/ui/Skeletons";
import { StatTile } from "@/components/ui/StatTile";
import { GoalEditor } from "../components/GoalEditor";
import { useGoals } from "../components/useGoals";
import { IconButton } from "@/components/ui/IconButton";

type Habit = LocalHabit & { deletedAt: string | null };
type HabitLog = LocalHabitLog & { deletedAt: string | null };

/** One goal: why, milestones to tick, the projects and habits that serve it, and its review. */
export default function GoalPage() {
  const { goalId = "" } = useParams();
  const runtime = useSyncRuntime();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const now = useNow(60_000);
  const today = localDate(now);
  const { byId, milestonesOf, loading } = useGoals();
  const ready = useDataReady(loading);
  const { projects } = useProjects();
  const { records: tasks } = useLocalRecords<Task>("task");
  const { records: habits } = useLocalRecords<Habit>("habit");
  const { records: logs } = useLocalRecords<HabitLog>("habit_log");
  const [editing, setEditing] = useState(false);
  const index = useMemo(() => indexLogs(logs), [logs]);

  const goal = byId.get(goalId);
  if (!goal && !ready) return <PageSkeleton />;
  if (!goal) {
    return (
      <ModulePage eyebrow="Goal" title="Goal not found">
        <Card className="pp-card">
          <EmptyState text="This goal was deleted, or hasn't reached this device yet." />
          <Link to="/goals">All goals</Link>
        </Card>
      </ModulePage>
    );
  }

  const milestones = milestonesOf(goal.id);
  const progress = goalProgress(milestones);
  const linkedProjects = projects.filter((p) => p.goalId === goal.id);
  const linkedHabits = habits.filter((h) => h.goalId === goal.id && !h.archivedAt);
  const next = nextReview(goal);

  const addMilestone = (title: string, due: string | null) => {
    const position = milestones.length ? Math.max(...milestones.map((m) => m.position)) + 1 : 0;
    void runtime.write("goal_milestone", newMilestone(runtime.newId(), new Date(), goal.id, title, position, due));
  };

  const remove = () => {
    const t = new Date();
    for (const m of milestones) void runtime.write("goal_milestone", m, "delete");
    for (const p of linkedProjects) void runtime.write("project", editProject(p, { goalId: null }, t));
    for (const h of linkedHabits) void runtime.write("habit", { ...h, goalId: null, updatedAt: t.toISOString() });
    void runtime.write("goal", goal, "delete");
    void message.success("Goal deleted");
    navigate("/goals");
  };

  return (
    <ModulePage
      eyebrow="Goal"
      title={goal.title}
      description={goal.description ?? undefined}
      back={
        <Link to="/goals" className="pp-back">
          <ArrowLeftOutlined /> All goals
        </Link>
      }
      actions={
        <Flex gap={8}>
          <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this goal?"
            description="Its milestones go with it; linked projects and habits stay."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={remove}
          >
            <IconButton type="default" danger icon={<DeleteOutlined />} tip="Delete goal" />
          </Popconfirm>
        </Flex>
      }
    >
      {reviewDue(goal, now) ? (
        <Alert
          type="warning"
          showIcon
          title="Time to review this goal"
          description="Is it still the right goal? What moved it on since last time, and what's the next step?"
          action={
            <Button size="small" type="primary" onClick={() => void runtime.write("goal", markReviewed(goal, new Date()))}>
              Mark reviewed
            </Button>
          }
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <StatTile
            icon={<PieChartOutlined />}
            label="Progress"
            subtitle={progress.total ? `${progress.done} of ${progress.total} milestones` : "Add milestones to track progress"}
            value={`${progress.percent}%`}
            hint={`${goalCardStats(milestones, today).reached.now} reached in 30 days`}
            trend={{ change: goalCardStats(milestones, today).reached.change, period: "vs the 30 days before" }}
            ring={{ percent: progress.total ? progress.percent : null, label: "Complete" }}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatTile size="small" icon={<AimOutlined />} iconTone="warning" label="Target" ring={{ percent: timeUsed(goal.createdAt, goal.targetDate, now), label: "Time Used" }} subtitle="Reach by" value={goal.targetDate ? formatDue(goal.targetDate, today) : "None"} tone="neutral" />
        </Col>
        <Col xs={12} md={6}>
          <StatTile
            size="small"
            icon={<FlagOutlined />}
            iconTone={goal.status === "achieved" ? "success" : goal.status === "dropped" ? "neutral" : "accent"}
            label="Status"
            ring={{ percent: reviewCycleUsed(goal, now), label: "Review Cycle" }}
            subtitle="Goal"
            value={goalStatusLabel[goal.status]}
            tone="neutral"
            hint={next ? `Next review ${formatDue(localDate(next), today).replace(/^(Today|Tomorrow|Yesterday)/, (w) => w.toLowerCase())}` : undefined}
          />
        </Col>
      </Row>

      <Card className="pp-card" title="Milestones" extra={<span className="pp-label pp-num">{progress.done}/{progress.total}</span>}>
        <Flex vertical gap={12}>
          <MilestoneAdder onAdd={addMilestone} />
          {milestones.length ? (
            <ul className="pp-note-list">
              {milestones.map((m) => (
                <li key={m.id} className="pp-milestone">
                  <Checkbox checked={!!m.doneAt} onChange={() => void runtime.write("goal_milestone", toggleMilestone(m, new Date()))}>
                    <span className={m.doneAt ? "pp-milestone-done" : undefined}>{m.title}</span>
                  </Checkbox>
                  {m.dueDate ? <span className={`pp-badge${!m.doneAt && m.dueDate < today ? " pp-badge-error" : ""}`}>{formatDue(m.dueDate, today)}</span> : null}
                  <Popconfirm title="Delete this milestone?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => void runtime.write("goal_milestone", m, "delete")}>
                    <IconButton size="small" danger icon={<DeleteOutlined />} tip="Delete milestone" label={`Delete milestone: ${m.title}`} />
                  </Popconfirm>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact text="No milestones yet. What are the 3–5 checkpoints on the way?" />
          )}
        </Flex>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="pp-card" title="Projects">
            <Flex vertical gap={10}>
              {linkedProjects.map((p) => {
                const pr = projectProgress(tasks.filter((t) => t.projectId === p.id));
                return (
                  <Flex key={p.id} align="center" gap={10}>
                    <Link to={`/projects/${p.id}`} style={{ flex: 1, minWidth: 0 }}>
                      {p.title}
                    </Link>
                    <span className="pp-progress-text pp-num">{pr.total ? `${pr.done}/${pr.total} tasks` : "No tasks"}</span>
                    <Button size="small" type="text" onClick={() => void runtime.write("project", editProject(p, { goalId: null }, new Date()))} aria-label={`Unlink ${p.title}`}>
                      Unlink
                    </Button>
                  </Flex>
                );
              })}
              <Select
                placeholder="Link a project"
                value={null}
                onChange={(id: string) => {
                  const p = projects.find((x) => x.id === id);
                  if (p) void runtime.write("project", editProject(p, { goalId: goal.id }, new Date()));
                }}
                options={projects.filter((p) => p.goalId !== goal.id && p.status !== "archived").map((p) => ({ value: p.id, label: p.title }))}
                notFoundContent="No other projects"
                aria-label="Link a project"
              />
            </Flex>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="pp-card" title="Habits">
            <Flex vertical gap={10}>
              {linkedHabits.map((h) => {
                const s = streak(h, index, today);
                return (
                  <Flex key={h.id} align="center" gap={10}>
                    <Link to="/habits" style={{ flex: 1, minWidth: 0 }}>
                      {h.title}
                    </Link>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {scheduleLabel(h)}
                    </Typography.Text>
                    {s ? (
                      <span className="pp-badge pp-badge-success">
                        <FireOutlined /> {s}
                      </span>
                    ) : null}
                    <Button size="small" type="text" onClick={() => void runtime.write("habit", { ...h, goalId: null, updatedAt: new Date().toISOString() })} aria-label={`Unlink ${h.title}`}>
                      Unlink
                    </Button>
                  </Flex>
                );
              })}
              <Select
                placeholder="Link a habit"
                value={null}
                onChange={(id: string) => {
                  const h = habits.find((x) => x.id === id);
                  if (h) void runtime.write("habit", { ...h, goalId: goal.id, updatedAt: new Date().toISOString() });
                }}
                options={habits.filter((h) => h.goalId !== goal.id && !h.archivedAt).map((h) => ({ value: h.id, label: h.title }))}
                notFoundContent="No other habits"
                aria-label="Link a habit"
              />
            </Flex>
          </Card>
        </Col>
      </Row>

      <GoalEditor
        goal={editing ? goal : null}
        onClose={() => setEditing(false)}
        onSave={(g) => {
          void runtime.write("goal", g);
          void message.success("Goal saved");
          setEditing(false);
        }}
      />
    </ModulePage>
  );
}

/** Type a milestone, optionally a date, press Enter. Its own component, so its input state stays local. */
function MilestoneAdder({ onAdd }: { onAdd: (title: string, due: string | null) => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<Dayjs | null>(null);
  const add = () => {
    if (!title.trim()) return;
    onAdd(title, due ? due.format("YYYY-MM-DD") : null);
    setTitle("");
    setDue(null);
  };
  return (
    <Flex gap={8} wrap>
      <Input
        prefix={<PlusOutlined />}
        placeholder="Add a milestone"
        aria-label="New milestone"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        onPressEnter={() => add()}
        style={{ flex: "1 1 260px" }}
      />
      <DatePicker value={due} onChange={setDue} placeholder="By (optional)" format="D MMM YYYY" aria-label="Milestone date" />
      <Button type="primary" onClick={add} disabled={!title.trim()}>
        Add
      </Button>
    </Flex>
  );
}
