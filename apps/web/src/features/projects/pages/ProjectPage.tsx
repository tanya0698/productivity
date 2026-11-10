import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { App as AntApp, Button, Card, Col, Collapse, Flex, Popconfirm, Row, Select, Typography } from "antd";
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import {
  editProject,
  groupTasks,
  localDate,
  noteDisplayTitle,
  projectProgress,
  sortNotes,
  toggleDone,
  unfile,
  type LocalNote,
  type ProjectStatus,
} from "@productivity/domain";
import {
  ModulePage,
  QuickAdd,
  TaskEditor,
  TaskRow,
  formatDue,
  useLocalRecords,
  useProjects,
  useSyncRuntime,
  type Task,
  useDataReady,
} from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSkeleton } from "@/components/ui/Skeletons";
import { StatTile } from "@/components/ui/StatTile";
import { ProjectEditor } from "../components/ProjectEditor";
import { ProjectProgress } from "../components/ProjectProgress";
import { statusOptions } from "../components/status";
import { IconButton } from "@/components/ui/IconButton";

type Note = LocalNote & { deletedAt: string | null };

/** One project: its tasks (add, tick, edit), its notes, its status, and how far along it is. */
export default function ProjectPage() {
  const { projectId = "" } = useParams();
  const runtime = useSyncRuntime();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const { projects, byId, loading } = useProjects();
  const ready = useDataReady(loading);
  const { records: allTasks } = useLocalRecords<Task>("task");
  const { records: allNotes } = useLocalRecords<Note>("note");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingProject, setEditingProject] = useState(false);

  const project = byId.get(projectId);
  const tasks = useMemo(() => allTasks.filter((t) => t.projectId === projectId), [allTasks, projectId]);
  const notes = useMemo(() => sortNotes(allNotes.filter((n) => n.projectId === projectId)), [allNotes, projectId]);
  const now = new Date();
  const today = localDate(now);
  const groups = useMemo(() => groupTasks(tasks, new Date(), localDate(new Date())), [tasks]);
  const openTasks = [...groups.overdue, ...groups.today, ...groups.upcoming, ...groups.someday];

  // Not here yet may only mean not downloaded yet: wait for the first sync before saying "not found".
  if (!project && !ready) return <PageSkeleton />;
  if (!project) {
    return (
      <ModulePage eyebrow="Project" title="Project not found">
        <Card className="pp-card">
          <EmptyState text="This project was deleted, or hasn't reached this device yet." />
          <Link to="/projects">All projects</Link>
        </Card>
      </ModulePage>
    );
  }

  const progress = projectProgress(tasks);
  const toggle = (task: Task) => void runtime.write("task", toggleDone(task, new Date()));
  const setStatus = (status: ProjectStatus) => void runtime.write("project", editProject(project, { status }, new Date()));

  const remove = async () => {
    // Its tasks and notes stay, filed under no project, on every device.
    const at = new Date();
    for (const t of tasks) await runtime.write("task", unfile(t, at));
    for (const n of notes) await runtime.write("note", unfile(n, at));
    await runtime.write("project", project, "delete");
    void message.success("Project deleted");
    navigate("/projects");
  };

  return (
    <ModulePage
      eyebrow="Project"
      title={project.title}
      description={project.description ?? undefined}
      back={
        <Link to="/projects" className="pp-back">
          <ArrowLeftOutlined /> All projects
        </Link>
      }
      actions={
        <Flex gap={8} wrap>
          <Select<ProjectStatus> value={project.status} onChange={setStatus} options={statusOptions} aria-label="Project status" style={{ width: 140 }} />
          <Button icon={<EditOutlined />} onClick={() => setEditingProject(true)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this project?"
            description={
              tasks.length || notes.length
                ? `Its ${count(tasks.length, "task")} and ${count(notes.length, "note")} stay, without a project.`
                : undefined
            }
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => void remove()}
          >
            <IconButton type="default" danger icon={<DeleteOutlined />} tip="Delete project" />
          </Popconfirm>
        </Flex>
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <div className="pp-tile">
            <span className="pp-label">Progress</span>
            <span className="pp-tile-value pp-num" style={{ color: "var(--pp-primary)" }}>
              {progress.percent}%
            </span>
            <ProjectProgress progress={progress} />
          </div>
        </Col>
        <Col xs={12} md={6}>
          <StatTile label="Open tasks" value={openTasks.length} tone={groups.overdue.length ? "error" : "primary"} hint={groups.overdue.length ? `${groups.overdue.length} overdue` : undefined} />
        </Col>
        <Col xs={12} md={6}>
          <StatTile label="Target" value={project.dueDate ? formatDue(project.dueDate, today) : "None"} tone="neutral" />
        </Col>
      </Row>

      <Card className="pp-card" title="Tasks" extra={<span className="pp-label pp-num">{openTasks.length}</span>}>
        <Flex vertical gap={12}>
          <QuickAdd projects={projects} projectId={project.id} />
          {openTasks.length ? (
            <div style={{ margin: "0 -12px" }}>
              {openTasks.map((t) => (
                <TaskRow key={t.id} task={t} now={now} today={today} onToggle={toggle} onOpen={setEditingTask} />
              ))}
            </div>
          ) : (
            <EmptyState compact text={tasks.length ? "Every task is done." : "No tasks yet. Add the first step above."} />
          )}
          {groups.done.length ? (
            <Collapse
              ghost
              items={[
                {
                  key: "done",
                  label: <span className="pp-label">Done · {groups.done.length}</span>,
                  children: groups.done.map((t) => (
                    <TaskRow key={t.id} task={t} now={now} today={today} onToggle={toggle} onOpen={setEditingTask} />
                  )),
                },
              ]}
            />
          ) : null}
        </Flex>
      </Card>

      <Card
        className="pp-card"
        title="Notes"
        extra={
          <Button size="small" icon={<PlusOutlined />} onClick={() => navigate(`/notes?new=1&project=${project.id}`)}>
            New note
          </Button>
        }
      >
        {notes.length ? (
          <ul className="pp-note-list">
            {notes.map((n) => (
              <li key={n.id}>
                <Link to={`/notes?note=${n.id}`}>{noteDisplayTitle(n)}</Link>
                <Typography.Text type="secondary" ellipsis style={{ display: "block", fontSize: 13 }}>
                  {n.bodyText.trim().split("\n").slice(n.title.trim() ? 0 : 1).join(" ") || "—"}
                </Typography.Text>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact text="No notes in this project. Meeting notes, research and ideas for it can live here." />
        )}
      </Card>

      <TaskEditor
        task={editingTask}
        projects={projects}
        onClose={() => setEditingTask(null)}
        onSave={(t) => {
          void runtime.write("task", t);
          setEditingTask(null);
          void message.success("Task saved");
        }}
        onDelete={(t) => {
          void runtime.write("task", t, "delete");
          setEditingTask(null);
          void message.success("Task deleted");
        }}
      />
      <ProjectEditor
        project={editingProject ? project : null}
        onClose={() => setEditingProject(false)}
        onSave={(p) => {
          void runtime.write("project", p);
          setEditingProject(false);
          void message.success("Project saved");
        }}
      />
    </ModulePage>
  );
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
