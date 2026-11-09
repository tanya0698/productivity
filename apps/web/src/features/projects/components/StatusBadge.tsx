import { projectStatusLabel, type ProjectStatus } from "@productivity/domain";
import { statusIcon } from "./status";

/** Status as icon plus words; "Done" in the success colour, the others neutral. */
export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`pp-badge${status === "done" ? " pp-badge-success" : ""}`}>
      {statusIcon(status)} {projectStatusLabel[status]}
    </span>
  );
}
