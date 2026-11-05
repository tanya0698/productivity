import React from "react";
import ScreenFrame from "../components/ScreenFrame";
import EmptyState from "../components/EmptyState";

/**
 * Today — the shell's home screen, like the web app's LandingPage. Modules
 * will contribute widgets here (overdue tasks, next event, reminders) once
 * they read from the local database.
 */
export default function TodayScreen() {
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  return (
    <ScreenFrame eyebrow={date} title="Today" capturePlaceholder="Capture a task, note or reminder…">
      <EmptyState
        title="Nothing scheduled yet"
        body="Tasks due today, your next event and reminders will appear here once the Tasks and Notes modules store data on this phone."
      />
    </ScreenFrame>
  );
}
