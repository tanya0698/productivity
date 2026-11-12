import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntApp, Button, Card, Col, Row, Segmented } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { byProject, isOpenProject, localDate, newProject, projectCardStats, projectStatusLabel, type ProjectStatus } from "@productivity/domain";
import { ModulePage, formatDue, useLocalRecords, useProjects, useSyncRuntime, type Project, type Task, useDataReady } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardGridSkeleton } from "@/components/ui/Skeletons";
import { ProjectEditor } from "../components/ProjectEditor";
import { EntityCard, type Tone } from "@/components/ui/EntityCard";
import { statusIcon } from "../components/status";

/** One colour per status, on the card's icon: active teal, on hold amber, done green, archived grey. */
const statusTone: Record<ProjectStatus, Tone> = { active: "primary", paused: "warning", done: "success", archived: "neutral" };

type View = "open" | "finished";

/** Every project as a card with its progress; open ones first, finished ones a click away. */
export default function HomePage() {
  const runtime = useSyncRuntime();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const { projects, loading } = useProjects();
  const ready = useDataReady(loading);
  const { records: tasks } = useLocalRecords<Task>("task");
  const [view, setView] = useState<View>("open");
  const [creating, setCreating] = useState<Project | null>(null);

  const tasksByProject = useMemo(() => byProject(tasks, projects), [tasks, projects]);
  const open = projects.filter(isOpenProject);
  const finished = projects.filter((p) => !isOpenProject(p));
  const shown = view === "open" ? open : finished;
  const today = localDate(new Date());

  return (
    <ModulePage
      eyebrow="Plan"
      title="Projects"
      description="Group tasks and notes around an outcome, and see how far along each one is."
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(newProject(runtime.newId(), new Date(), { title: "" }))}>
          New project
        </Button>
      }
    >
      {finished.length ? (
        <Segmented<View>
          value={view}
          onChange={setView}
          options={[
            { value: "open", label: `Open · ${open.length}` },
            { value: "finished", label: `Done & archived · ${finished.length}` },
          ]}
          style={{ alignSelf: "flex-start" }}
        />
      ) : null}

      {!ready && !projects.length ? <CardGridSkeleton count={3} /> : null}

      {ready && !shown.length ? (
        <Card className="pp-card">
          <EmptyState
            text={
              view === "open"
                ? "No open projects. Start one for anything with more than a couple of steps: a trip, a move, a launch."
                : "Nothing finished yet."
            }
          />
        </Card>
      ) : null}

      <Row gutter={[16, 16]}>
        {shown.map((p) => {
          const stats = projectCardStats(tasksByProject.get(p.id) ?? [], today);
          return (
            <Col key={p.id} xs={24} sm={12} xl={6}>
              <EntityCard
                icon={statusIcon(p.status)}
                tone={statusTone[p.status]}
                title={p.title}
                subtitle={[projectStatusLabel[p.status], p.dueDate ? `Target ${formatDue(p.dueDate, today)}` : null].filter(Boolean).join(" · ")}
                value={stats.doneThisWeek.now}
                trend={{ change: stats.doneThisWeek.change }}
                caption={`done this week · ${stats.progress.total ? `${stats.progress.done} of ${stats.progress.total} tasks` : "no tasks yet"}`}
                ring={{ percent: stats.progress.total ? stats.progress.percent : null, label: "Complete" }}
                onOpen={() => navigate(p.id)}
                ariaLabel={`Open project: ${p.title}`}
              />
            </Col>
          );
        })}
      </Row>

      <ProjectEditor
        project={creating}
        isNew
        onClose={() => setCreating(null)}
        onSave={(p) => {
          void runtime.write("project", p);
          setCreating(null);
          void message.success("Project created");
          navigate(p.id);
        }}
      />
    </ModulePage>
  );
}
