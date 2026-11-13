import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, ToastAndroid, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ConflictEntry, LocalRecord, OutboxEntry } from "@productivity/database-local";
import { change, freshness, localDate, noteDisplayTitle, priorityLabel, type LocalNote, type LocalTask } from "@productivity/domain";
import { syncHistoryStats } from "@productivity/sync-engine";
import { useSyncDetails, useSyncHistory, useSyncRuntime, useSyncStatus } from "@productivity/sync-engine/react";
import { Button } from "../components/Field";
import { Card } from "../components/ListCard";
import ScreenFrame from "../components/ScreenFrame";
import { StatRow, StatTile } from "../components/StatTile";
import Text from "../components/Text";
import { formatDue } from "../shared/projects";
import { radii, usePalette } from "../theme";

type Choice = "mine" | "theirs" | "both";
const toast = (m: string) => Platform.OS === "android" && ToastAndroid.show(m, ToastAndroid.SHORT);

/**
 * Sync on the phone, as on the web: how it's going (with the last hour
 * against the hour before), a button to sync now, anything edited on two
 * devices at once with a choice of which version to keep, and the changes
 * still waiting to go out.
 */
export default function SyncScreen() {
  const runtime = useSyncRuntime();
  const p = usePalette();
  const status = useSyncStatus();
  const { conflicts, queued, loading } = useSyncDetails();
  const lastSyncedAt = runtime.getLastSyncedAt();
  const history = syncHistoryStats(useSyncHistory(), new Date());
  const rate = history.successRate;
  const syncing = status.state === "syncing";

  return (
    <ScreenFrame eyebrow="Settings" title="Sync">
      {status.state === "needs_attention" && status.reason !== "conflict" ? (
        <View style={[styles.banner, { backgroundColor: status.reason === "auth" ? p.warningSoft : p.errorSoft }]}>
          <Ionicons name="alert-circle" size={20} color={status.reason === "auth" ? p.warningText : p.errorText} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="semiBold" style={{ color: status.reason === "auth" ? p.warningText : p.errorText }}>
              {status.reason === "auth" ? "Your session has expired. Sign out and back in to sync again." : "Sync stopped with an error."}
            </Text>
            {status.reason === "error" && status.detail ? (
              <Text style={{ color: p.errorText, fontSize: 12 }}>{status.detail}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <StatRow>
        <StatTile
          icon="sync"
          iconTone={status.state === "needs_attention" ? "error" : "primary"}
          label="Status"
          subtitle="This phone"
          value={statusText(status.state)}
          compact
          tone={status.state === "needs_attention" ? "error" : undefined}
          trend={{ now: rate.now ?? 0, change: rate.now !== null && rate.before !== null ? rate.now - rate.before : null, unit: " pts", period: "vs the hour before" }}
          ring={{ percent: rate.now ?? (status.state === "needs_attention" ? 0 : 100), label: "Succeeded" }}
        />
        <StatTile
          icon="time"
          iconTone="accent"
          label="Last synced"
          subtitle="With the server"
          value={lastSyncedAt ? timeAgo(lastSyncedAt) : "Not yet"}
          compact
          hint={`${history.synced.now} sync${history.synced.now === 1 ? "" : "s"} in the last hour`}
          trend={{ now: history.synced.now, change: change(history.synced.now, history.synced.before), period: "vs the hour before" }}
          ring={{ percent: freshness(lastSyncedAt ? new Date(lastSyncedAt) : null, new Date()), label: "Fresh" }}
        />
        <StatTile
          icon="cloud-upload"
          iconTone={queued.length ? "warning" : "success"}
          label="Waiting to send"
          subtitle="Changes"
          value={loading ? "…" : queued.length}
          trend={{
            now: queued.length,
            change: history.queuedHourAgo === null ? null : change(queued.length, history.queuedHourAgo),
            goodWhenUp: false,
            period: "vs an hour ago",
          }}
          ring={{ percent: loading ? 0 : queued.length ? 0 : 100, label: "Sent" }}
        />
      </StatRow>

      <Button kind="primary" label={syncing ? "Syncing…" : "Sync now"} disabled={syncing} onPress={() => void runtime.syncNow()} />

      <Card title={`Conflicts${conflicts.length ? ` · ${conflicts.length}` : ""}`}>
        {conflicts.length ? (
          conflicts.map((c, i) => <ConflictCard key={`${c.entityType}:${c.entityId}`} conflict={c} first={i === 0} />)
        ) : (
          <Text tone="secondary" style={{ paddingBottom: 12 }}>
            No conflicts. If something is edited on two devices at once, it shows up here for you to settle.
          </Text>
        )}
      </Card>

      {queued.length ? (
        <Card title={`Waiting to send · ${queued.length}`}>
          {queued.map((q, i) => (
            <QueuedRow key={q.operation.operationId} entry={q} first={i === 0} />
          ))}
        </Card>
      ) : null}
    </ScreenFrame>
  );
}

function ConflictCard({ conflict, first }: { conflict: ConflictEntry; first: boolean }) {
  const runtime = useSyncRuntime();
  const p = usePalette();
  const [busy, setBusy] = useState<Choice | null>(null);
  const kind = conflict.entityType === "task" ? "Task" : conflict.entityType === "note" ? "Note" : "Project";
  const rows = describe(conflict.entityType, conflict.local, conflict.server);

  const resolve = async (choice: Choice) => {
    setBusy(choice);
    try {
      await runtime.resolveConflict(conflict.entityType, conflict.entityId, choice);
      toast(choice === "both" ? "Kept both versions" : "Conflict settled");
    } catch (e) {
      toast(`Couldn't settle it: ${String(e)}`);
      setBusy(null);
    }
  };

  return (
    <View style={[styles.conflict, { borderColor: p.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={[styles.tag, { backgroundColor: p.muted }]}>
          <Text style={{ fontSize: 11, color: p.textSecondary }}>{kind}</Text>
        </View>
        <Text weight="semiBold" numberOfLines={1} style={{ flex: 1 }}>
          {titleOf(conflict.entityType, conflict.server)}
        </Text>
        <Text tone="muted" style={{ fontSize: 11 }}>
          {timeAgo(conflict.detectedAt)}
        </Text>
      </View>
      <View style={[styles.grid, { borderColor: p.border }]}>
        <View style={styles.gridRow}>
          <Text label style={[styles.cellLabel, { fontSize: 9 }]}> </Text>
          <Text label style={[styles.cell, { fontSize: 9 }]}>
            This phone
          </Text>
          <Text label style={[styles.cell, { fontSize: 9 }]}>
            Server
          </Text>
        </View>
        {rows.map((r) => (
          <View key={r.label} style={[styles.gridRow, r.differs && { backgroundColor: p.warningSoft }]}>
            <Text tone="secondary" style={[styles.cellLabel, { fontSize: 12 }]}>
              {r.label}
            </Text>
            <Text numberOfLines={3} style={[styles.cell, { fontSize: 13 }]}>
              {r.mine}
            </Text>
            <Text numberOfLines={3} style={[styles.cell, { fontSize: 13 }]}>
              {r.theirs}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <Button kind="primary" label={busy === "mine" ? "Keeping…" : "Keep this phone's"} disabled={!!busy} onPress={() => void resolve("mine")} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button label={busy === "theirs" ? "Keeping…" : "Keep the server's"} disabled={!!busy} onPress={() => void resolve("theirs")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={busy === "both" ? "Keeping…" : "Keep both"} disabled={!!busy} onPress={() => void resolve("both")} />
          </View>
        </View>
      </View>
    </View>
  );
}

function QueuedRow({ entry, first }: { entry: OutboxEntry; first: boolean }) {
  const p = usePalette();
  const { operation: op, attempts, lastError } = entry;
  const payload = (op.payload ?? {}) as Partial<LocalRecord>;
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title : "Untitled";
  return (
    <View style={[styles.queued, { borderColor: p.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={[styles.tag, { backgroundColor: p.muted }]}>
          <Text style={{ fontSize: 11, color: p.textSecondary }}>{op.entityType}</Text>
        </View>
        <Text weight="medium">{op.op === "delete" ? "Delete" : op.baseVersion ? "Edit" : "New"}</Text>
        <Text tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
          {op.op === "delete" ? "" : title}
        </Text>
      </View>
      <Text tone="muted" style={{ fontSize: 11 }}>
        {`${timeAgo(op.clientTimestamp)}${attempts ? ` · ${attempts} failed ${attempts === 1 ? "try" : "tries"}` : ""}`}
      </Text>
      {lastError ? <Text style={{ color: p.errorText, fontSize: 12 }}>{lastError}</Text> : null}
    </View>
  );
}

interface FieldRow {
  label: string;
  mine: string;
  theirs: string;
  differs: boolean;
}

/** The fields a person would recognise, side by side (the same as the web). */
function describe(entity: ConflictEntry["entityType"], mine: LocalRecord, theirs: LocalRecord): FieldRow[] {
  const today = localDate(new Date());
  const task = (r: LocalRecord) => r as unknown as LocalTask;
  const fields: Array<[string, (r: LocalRecord) => string]> =
    entity === "task"
      ? [
          ["Title", (r) => task(r).title || "Untitled"],
          ["Status", (r) => statusName(task(r).status)],
          ["Due", (r) => (task(r).dueDate ? formatDue(task(r).dueDate!, today) : "No date")],
          ["Priority", (r) => priorityLabel[task(r).priority] ?? "Normal"],
          ["Details", (r) => task(r).description || "—"],
        ]
      : entity === "note"
        ? [
            ["Title", (r) => noteDisplayTitle(r as unknown as LocalNote)],
            ["Text", (r) => (r as unknown as LocalNote).bodyText || "—"],
          ]
        : [["Name", (r) => String(r.name ?? r.title ?? "Untitled")]];
  const rows = fields.map(([label, read]) => {
    const [a, b] = [read(mine), read(theirs)];
    return { label, mine: a, theirs: b, differs: a !== b };
  });
  const deleted = (r: LocalRecord) => (r.deletedAt ? "Deleted" : "Kept");
  if (mine.deletedAt || theirs.deletedAt) {
    rows.push({ label: "Deleted?", mine: deleted(mine), theirs: deleted(theirs), differs: !!mine.deletedAt !== !!theirs.deletedAt });
  }
  rows.push({
    label: "Edited",
    mine: typeof mine.updatedAt === "string" ? timeAgo(mine.updatedAt) : "—",
    theirs: typeof theirs.updatedAt === "string" ? timeAgo(theirs.updatedAt) : "—",
    differs: false,
  });
  return rows;
}

function titleOf(entity: ConflictEntry["entityType"], r: LocalRecord): string {
  if (entity === "note") return noteDisplayTitle(r as unknown as LocalNote);
  const t = (r.title ?? r.name) as string | undefined;
  return t?.trim() ? t : "Untitled";
}

const statusName = (s: LocalTask["status"]) =>
  ({ inbox: "Inbox", todo: "To do", in_progress: "In progress", done: "Done", cancelled: "Cancelled" })[s] ?? s;

function statusText(state: ReturnType<typeof useSyncStatus>["state"]): string {
  return { idle: "Up to date", pending: "Changes to send", syncing: "Syncing", offline: "Offline", needs_attention: "Needs attention" }[state];
}

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", gap: 10, borderRadius: radii.md, padding: 12, alignItems: "flex-start" },
  conflict: { paddingVertical: 12, gap: 10 },
  tag: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  grid: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.sm, overflow: "hidden" },
  gridRow: { flexDirection: "row", gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
  cellLabel: { width: 64 },
  cell: { flex: 1 },
  queued: { paddingVertical: 10, gap: 3 },
});
