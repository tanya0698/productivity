import { Link } from "react-router-dom";
import { Flex } from "antd";
import { byProject, projectProgress } from "@productivity/domain";
import { useLocalRecords, useProjects, type Task, useDataReady } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowsSkeleton } from "@/components/ui/Skeletons";
import { ProjectProgress } from "../components/ProjectProgress";

/** Today's view of active projects and how far along each is. */
export default function SummaryWidget() {
  const { projects } = useProjects();
  const ready = useDataReady();
  const { records: tasks } = useLocalRecords<Task>("task");
  const active = projects.filter((p) => p.status === "active").slice(0, 4);
  const grouped = byProject(tasks, projects);

  if (!active.length) {
    return ready ? <EmptyState compact text="No active projects. Group a bigger piece of work under one." /> : <RowsSkeleton rows={3} check={false} />;
  }
  return (
    <Flex vertical gap={14}>
      {active.map((p) => (
        <Link key={p.id} to={`/projects/${p.id}`} className="pp-widget-project">
          <span className="pp-task-title">{p.title}</span>
          <ProjectProgress progress={projectProgress(grouped.get(p.id) ?? [])} />
        </Link>
      ))}
      <Link to="/projects">All projects</Link>
    </Flex>
  );
}
