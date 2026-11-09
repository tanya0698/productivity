import { Link } from "react-router-dom";
import { Flex } from "antd";
import { byProject, projectProgress } from "@productivity/domain";
import { useLocalRecords, useProjects, type Task } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProjectProgress } from "../components/ProjectProgress";

/** Today's view of active projects and how far along each is. */
export default function SummaryWidget() {
  const { projects } = useProjects();
  const { records: tasks } = useLocalRecords<Task>("task");
  const active = projects.filter((p) => p.status === "active").slice(0, 4);
  const grouped = byProject(tasks, projects);

  if (!active.length) {
    return <EmptyState compact text="No active projects. Group a bigger piece of work under one." />;
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
