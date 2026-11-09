import { Select } from "antd";
import { FolderOutlined } from "@ant-design/icons";
import { isOpenProject } from "@productivity/domain";
import type { Project } from "./useProjects";

/**
 * Pick a project, or none. Lists open projects; a finished one still shows
 * when it's the current value, so editing an old task doesn't drop it.
 */
export function ProjectSelect({
  projects,
  value,
  onChange,
  ...rest
}: {
  projects: readonly Project[];
  value?: string | null;
  onChange?: (value: string | null) => void;
  size?: "small" | "middle" | "large";
  variant?: "outlined" | "borderless" | "filled" | "underlined";
  style?: React.CSSProperties;
  "aria-label"?: string;
  placeholder?: string;
}) {
  const options = projects
    .filter((p) => isOpenProject(p) || p.id === value)
    .map((p) => ({ value: p.id, label: p.title }));
  return (
    <Select
      allowClear
      showSearch={{ optionFilterProp: "label" }}
      placeholder="No project"
      suffixIcon={<FolderOutlined />}
      value={value && options.some((o) => o.value === value) ? value : null}
      onChange={(v) => onChange?.(v ?? null)}
      options={options}
      notFoundContent="No projects yet"
      {...rest}
    />
  );
}

/** The project a task or note belongs to, as a small tag. */
export function ProjectTag({ title }: { title: string }) {
  return (
    <span className="pp-badge pp-badge-project">
      <FolderOutlined /> {title}
    </span>
  );
}
