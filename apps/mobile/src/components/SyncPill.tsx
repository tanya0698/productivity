import React from "react";
import type { SyncStatus } from "@productivity/sync-engine";
import { useSyncStatus } from "@productivity/sync-engine/react";
import GlassCard from "./GlassCard";
import Text from "./Text";
import { radii } from "../theme";

/** The sync states from plan §6.6, in the same words as the web app. */
function label(status: SyncStatus): string {
  switch (status.state) {
    case "syncing":
      return "Syncing";
    case "pending":
      return "Saved on this device";
    case "offline":
      return status.pending ? `Offline — ${status.pending} queued` : "Offline";
    case "needs_attention":
      if (status.reason === "conflict") return "Needs attention — conflict";
      return status.reason === "auth" ? "Sign in again to sync" : "Needs attention — sync stopped";
    case "idle":
      return status.lastSyncedAt ? "Synced" : "Saved on this device";
  }
}

export default function SyncPill() {
  const status = useSyncStatus();
  return (
    <GlassCard style={{ borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text label tone="secondary" style={{ fontSize: 10, letterSpacing: 1 }} accessibilityLiveRegion="polite">
        {label(status)}
      </Text>
    </GlassCard>
  );
}
