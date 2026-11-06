import React from "react";
import ScreenFrame from "../../../components/ScreenFrame";
import EmptyState from "../../../components/EmptyState";

/** Phase 2: list from the local database via the module's data/ hooks. */
export default function TasksScreen() {
  return (
    <ScreenFrame eyebrow="Plan" title="Tasks" capturePlaceholder="Add a task…">
      <EmptyState
        title="No tasks yet"
        body="Tasks you capture here or on the web will show up in this list, grouped by due date."
      />
    </ScreenFrame>
  );
}
