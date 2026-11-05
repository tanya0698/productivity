import React from "react";
import ScreenFrame from "../../../components/ScreenFrame";
import EmptyState from "../../../components/EmptyState";

/** Gradient header + solid sheet, like every tab screen (plan §4.4). */
export default function MyModuleScreen() {
  return (
    <ScreenFrame title="MyModule">
      <EmptyState title="Nothing here yet" body="Items you add on any device will appear here." />
    </ScreenFrame>
  );
}
