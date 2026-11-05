import React from "react";
import ScreenFrame from "../../../components/ScreenFrame";
import EmptyState from "../../../components/EmptyState";

/** Phase 2: notes list and editor backed by the local database. */
export default function NotesScreen() {
  return (
    <ScreenFrame title="Notes" capturePlaceholder="Write a quick note…">
      <EmptyState
        title="No notes yet"
        body="Notes are saved on this phone first and sync to the web app when you're online."
      />
    </ScreenFrame>
  );
}
