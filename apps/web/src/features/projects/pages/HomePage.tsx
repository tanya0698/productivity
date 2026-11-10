import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntApp, Button, Card, Col, Flex, Row, Segmented, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { byProject, isOpenProject, localDate, newProject, projectProgress } from "@productivity/domain";
import { ModulePage, formatDue, useLocalRecords, useProjects, useSyncRuntime, type Project, type Task, useDataReady } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardGridSkeleton } from "@/components/ui/Skeletons";
import { ProjectEditor } from "../components/ProjectEditor";
import { ProjectProgress } from "../components/ProjectProgress";
import { StatusBadge } from "../components/StatusBadge";

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
          const projectTasks = tasksByProject.get(p.id) ?? [];
          return (
            <Col key={p.id} xs={24} md={12} xl={8}>
              <Card
                className="pp-card pp-project-card"
                hoverable
                onClick={() => navigate(p.id)}
                role="link"
                tabIndex={0}
                aria-label={`Open project: ${p.title}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate(p.id);
                }}
              >
                <Flex vertical gap={10}>
                  <Flex align="flex-start" gap={8}>
                    <Typography.Text strong style={{ fontSize: 16, flex: 1, minWidth: 0 }} ellipsis>
                      {p.title}
                    </Typography.Text>
                    {p.status !== "active" ? <StatusBadge status={p.status} /> : null}
                  </Flex>
                  {p.description ? (
                    <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                      {p.description}
                    </Typography.Paragraph>
                  ) : null}
                  <ProjectProgress progress={projectProgress(projectTasks)} />
                  {p.dueDate ? (
                    <span className="pp-label" style={{ fontSize: 10 }}>
                      Target · {formatDue(p.dueDate, today)}
                    </span>
                  ) : null}
                </Flex>
              </Card>
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
