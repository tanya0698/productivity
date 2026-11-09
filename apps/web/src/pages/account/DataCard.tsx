import { useRef, useState } from "react";
import { Alert, App as AntApp, Button, Card, Flex, Progress, Typography } from "antd";
import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import {
  BACKUP_ORDER,
  backupCounts,
  backupLabel,
  buildBackup,
  localDate,
  parseBackup,
  planImport,
  type BackupEntity,
  type ImportPlan,
} from "@productivity/domain";
import { useSyncRuntime } from "@productivity/sync-engine/react";

/**
 * Export everything on this device as one JSON file, or import one. Import
 * shows what it will do first, never overwrites, and gives new records fresh
 * ids, so a backup can also go into another account.
 */
export function DataCard() {
  const runtime = useSyncRuntime();
  const { message } = AntApp.useApp();
  const file = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; plan: ImportPlan } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const exportAll = async () => {
    setExporting(true);
    try {
      const records: Partial<Record<BackupEntity, Record<string, unknown>[]>> = {};
      for (const e of BACKUP_ORDER) records[e] = (await runtime.db.list(e)) as Record<string, unknown>[];
      const backup = buildBackup(records, new Date());
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `creedence-backup-${localDate(new Date())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const total = backupCounts(backup).reduce((n, c) => n + c.count, 0);
      void message.success(`Exported ${total} item${total === 1 ? "" : "s"}`);
    } finally {
      setExporting(false);
    }
  };

  const read = async (f: File) => {
    setError(null);
    setPreview(null);
    const parsed = parseBackup(await f.text());
    if (!parsed.ok) return setError(parsed.error);
    // What's already on this device (deleted records too, so a delete isn't undone).
    const known = new Set<string>();
    for (const e of BACKUP_ORDER) {
      for (const r of parsed.backup.data[e] ?? []) {
        if (r && typeof r.id === "string" && (await runtime.db.get(e, r.id))) known.add(`${e}:${r.id}`);
      }
    }
    const plan = planImport(parsed.backup, (e, id) => known.has(`${e}:${id}`), () => runtime.newId(), new Date());
    setPreview({ name: f.name, plan });
  };

  const runImport = async () => {
    if (!preview) return;
    const { writes } = preview.plan;
    setProgress(0);
    // In order, parents first, so every link points at something already saved.
    for (let i = 0; i < writes.length; i++) {
      const w = writes[i]!;
      await runtime.write(w.entity, w.record as never);
      if (i % 20 === 0) setProgress(Math.round(((i + 1) / writes.length) * 100));
    }
    setProgress(null);
    setPreview(null);
    void message.success(`Imported ${writes.length} item${writes.length === 1 ? "" : "s"}`);
  };

  const added = preview?.plan.summary.reduce((n, r) => n + r.added, 0) ?? 0;

  return (
    <Card title="Your data" className="pp-card">
      <Flex vertical gap={16}>
        <Typography.Text type="secondary">
          Download everything as one JSON file: tasks, notes, projects, reminders, calendar, habits, focus sessions and goals. Import a backup
          to restore it here or move it to another account. Importing never overwrites anything; items you already have are skipped.
        </Typography.Text>
        <Flex gap={8} wrap>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => void exportAll()}>
            Export backup
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => file.current?.click()} disabled={progress !== null}>
            Import backup…
          </Button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="Backup file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void read(f);
            }}
          />
        </Flex>

        {error ? <Alert type="error" showIcon title={error} /> : null}

        {preview ? (
          <div className="pp-import-preview">
            <Typography.Text strong>{preview.name}</Typography.Text>
            <ul className="pp-note-list">
              {preview.plan.summary.map((r) => (
                <li key={r.entity} className="pp-import-row">
                  <span>{backupLabel[r.entity]}</span>
                  <span className="pp-num">
                    {r.added ? <strong>{r.added} new</strong> : "nothing new"}
                    {r.existing ? ` · ${r.existing} already here` : ""}
                    {r.orphaned ? ` · ${r.orphaned} skipped (missing what they belong to)` : ""}
                    {r.invalid ? ` · ${r.invalid} unreadable` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {progress !== null ? <Progress percent={progress} size="small" /> : null}
            <Flex gap={8} justify="flex-end">
              <Button onClick={() => setPreview(null)} disabled={progress !== null}>
                Cancel
              </Button>
              <Button type="primary" onClick={() => void runImport()} disabled={!added} loading={progress !== null}>
                {added ? `Import ${added} item${added === 1 ? "" : "s"}` : "Nothing to import"}
              </Button>
            </Flex>
          </div>
        ) : null}
      </Flex>
    </Card>
  );
}
