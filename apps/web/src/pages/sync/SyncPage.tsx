import { useState, type ReactNode } from "react";
import { Alert, App as AntApp, Button, Card, Col, Flex, Row, Tag, Typography } from "antd";
import { ClockCircleOutlined, CloudUploadOutlined, SyncOutlined } from "@ant-design/icons";
import type { ConflictEntry, LocalRecord, OutboxEntry } from "@productivity/database-local";
import { freshness, localDate, noteDisplayTitle, priorityLabel, type LocalNote, type LocalTask } from "@productivity/domain";
import { useSyncDetails, useSyncRuntime, useSyncStatus } from "@productivity/sync-engine/react";
import { ModulePage } from "@/shared/page/ModulePage";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDue } from "@/shared/tasks/formatDue";

type Choice = "mine" | "theirs" | "both";

/**
 * Sync & conflicts (plan §6.5, §6.6): what's waiting to go out, when the last
 * sync finished, and any record edited on two devices at once, with a choice
 * of which version to keep.
 */
export default function SyncPage() {
  const runtime = useSyncRuntime();
  const status = useSyncStatus();
  const { conflicts, queued, loading } = useSyncDetails();
  const lastSyncedAt = runtime.getLastSyncedAt();

  return (
    <ModulePage
      eyebrow="Sync"
      title="Sync & conflicts"
      description="Everything is saved on this device first, then sent to your account when there's a connection."
      actions={
        <Button icon={<SyncOutlined spin={status.state === "syncing"} />} onClick={() => void runtime.syncNow()} disabled={status.state === "syncing"}>
          Sync now
        </Button>
      }
    >
      <Flex vertical gap={16}>
        {status.state === "needs_attention" && status.reason !== "conflict" ? (
          <Alert
            type={status.reason === "auth" ? "warning" : "error"}
            showIcon
            message={status.reason === "auth" ? "Your session has expired. Sign out and back in to sync again." : "Sync stopped with an error."}
            description={status.reason === "error" ? status.detail : undefined}
          />
        ) : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <StatTile
              size="small"
              icon={<SyncOutlined />}
              iconTone={status.state === "needs_attention" ? "error" : "primary"}
              label="Status"
              ring={{ percent: queued.length ? 0 : 100, label: "Sent" }}
              subtitle="This device"
              value={statusText(status.state)}
              tone={status.state === "needs_attention" ? "error" : "primary"}
            />
          </Col>
          <Col xs={24} sm={8}>
            <StatTile size="small" icon={<ClockCircleOutlined />} iconTone="accent" label="Last synced" ring={{ percent: freshness(lastSyncedAt ? new Date(lastSyncedAt) : null, new Date()), label: "Fresh" }} subtitle="With the server" value={lastSyncedAt ? timeAgo(lastSyncedAt) : "Not yet"} />
          </Col>
          <Col xs={24} sm={8}>
            <StatTile
              size="small"
              icon={<CloudUploadOutlined />}
              iconTone={queued.length ? "warning" : "success"}
              label="Waiting to send"
              ring={{ percent: loading ? 0 : queued.length ? 0 : 100, label: "Sent" }}
              subtitle="Changes"
              value={loading ? "…" : String(queued.length)}
            />
          </Col>
        </Row>

        <Card title={`Conflicts${conflicts.length ? ` (${conflicts.length})` : ""}`} className="pp-card">
          {conflicts.length === 0 ? (
            <EmptyState text="No conflicts. If something is edited on two devices at once, it shows up here for you to settle." />
          ) : (
            <Flex vertical gap={16}>
              {conflicts.map((c) => (
                <ConflictCard key={`${c.entityType}:${c.entityId}`} conflict={c} />
              ))}
            </Flex>
          )}
        </Card>

        {queued.length ? (
          <Card title="Waiting to send" className="pp-card">
            <Flex vertical gap={8}>
              {queued.map((q) => (
                <QueuedRow key={q.operation.operationId} entry={q} />
              ))}
            </Flex>
          </Card>
        ) : null}
      </Flex>
    </ModulePage>
  );
}

function ConflictCard({ conflict }: { conflict: ConflictEntry }) {
  const runtime = useSyncRuntime();
  const { message } = AntApp.useApp();
  const [busy, setBusy] = useState<Choice | null>(null);
  const kind = conflict.entityType === "task" ? "Task" : conflict.entityType === "note" ? "Note" : "Project";
  const rows = describe(conflict.entityType, conflict.local, conflict.server);

  const resolve = async (choice: Choice) => {
    setBusy(choice);
    try {
      await runtime.resolveConflict(conflict.entityType, conflict.entityId, choice);
      void message.success(choice === "both" ? "Kept both versions" : "Conflict settled");
    } catch (e) {
      void message.error(`Couldn't settle it: ${String(e)}`);
      setBusy(null);
    }
  };

  return (
    <section className="pp-conflict" aria-label={`Conflict: ${titleOf(conflict.entityType, conflict.server)}`}>
      <Flex align="center" gap={8} wrap style={{ marginBottom: 12 }}>
        <Tag>{kind}</Tag>
        <Typography.Text strong>{titleOf(conflict.entityType, conflict.server)}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: "auto" }}>
          Found {timeAgo(conflict.detectedAt)}
        </Typography.Text>
      </Flex>

      <div className="pp-conflict-grid" role="table">
        <div role="row" className="pp-conflict-head">
          <span role="columnheader" />
          <span role="columnheader" className="pp-label">On this device</span>
          <span role="columnheader" className="pp-label">On the server</span>
        </div>
        {rows.map((r) => (
          <div role="row" key={r.label} className={r.differs ? "pp-conflict-row pp-conflict-differs" : "pp-conflict-row"}>
            <span role="rowheader" className="pp-label">{r.label}</span>
            <span role="cell">{r.mine}</span>
            <span role="cell">{r.theirs}</span>
          </div>
        ))}
      </div>

      <Flex gap={8} wrap style={{ marginTop: 12 }}>
        <Button type="primary" loading={busy === "mine"} disabled={!!busy} onClick={() => void resolve("mine")}>
          Keep this device's
        </Button>
        <Button loading={busy === "theirs"} disabled={!!busy} onClick={() => void resolve("theirs")}>
          Keep the server's
        </Button>
        <Button loading={busy === "both"} disabled={!!busy} onClick={() => void resolve("both")}>
          Keep both
        </Button>
      </Flex>
    </section>
  );
}

function QueuedRow({ entry }: { entry: OutboxEntry }) {
  const { operation: op, attempts, lastError } = entry;
  const payload = (op.payload ?? {}) as Partial<LocalRecord>;
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title : "Untitled";
  return (
    <Flex align="center" gap={8} wrap className="pp-queued">
      <Tag>{op.entityType}</Tag>
      <Typography.Text>{op.op === "delete" ? "Delete" : op.baseVersion ? "Edit" : "New"}</Typography.Text>
      <Typography.Text type="secondary" ellipsis style={{ maxWidth: 360 }}>
        {op.op === "delete" ? "" : title}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: "auto" }}>
        {timeAgo(op.clientTimestamp)}
        {attempts ? ` · ${attempts} failed ${attempts === 1 ? "try" : "tries"}` : ""}
      </Typography.Text>
      {lastError ? (
        <Typography.Text type="danger" style={{ fontSize: 12, width: "100%" }}>
          {lastError}
        </Typography.Text>
      ) : null}
    </Flex>
  );
}

interface FieldRow {
  label: string;
  mine: ReactNode;
  theirs: ReactNode;
  differs: boolean;
}

/** The fields a person would recognise, side by side. */
function describe(entity: ConflictEntry["entityType"], mine: LocalRecord, theirs: LocalRecord): FieldRow[] {
  const today = localDate(new Date());
  const fields: Array<[string, (r: LocalRecord) => string]> =
    entity === "task"
      ? [
          ["Title", (r) => (r as unknown as LocalTask).title || "Untitled"],
          ["Status", (r) => statusName((r as unknown as LocalTask).status)],
          ["Due", (r) => ((r as unknown as LocalTask).dueDate ? formatDue((r as unknown as LocalTask).dueDate!, today) : "No date")],
          ["Priority", (r) => priorityLabel[(r as unknown as LocalTask).priority] ?? "Normal"],
          ["Details", (r) => (r as unknown as LocalTask).description || "—"],
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
    label: "Last edited",
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
