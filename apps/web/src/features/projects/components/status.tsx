import { CheckCircleOutlined, InboxOutlined, PauseCircleOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { projectStatusLabel, type ProjectStatus } from "@productivity/domain";

const icons: Record<ProjectStatus, React.ReactNode> = {
  active: <PlayCircleOutlined />,
  paused: <PauseCircleOutlined />,
  done: <CheckCircleOutlined />,
  archived: <InboxOutlined />,
};

/** The Select options for a project's status: icon plus words. */
export const statusOptions = (Object.keys(projectStatusLabel) as ProjectStatus[]).map((s) => ({
  value: s,
  label: (
    <span>
      {icons[s]} {projectStatusLabel[s]}
    </span>
  ),
}));

export const statusIcon = (s: ProjectStatus) => icons[s];
