import { useMemo } from "react";
import { Flex, List, Typography } from "antd";
import { Link } from "react-router-dom";
import { noteDisplayTitle, sortNotes, type LocalNote } from "@productivity/domain";
import { useLocalRecords } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";

/** The Today page's "Recent notes" panel. */
export default function SummaryWidget() {
  const { records } = useLocalRecords<LocalNote & { deletedAt: string | null }>("note");
  const recent = useMemo(() => sortNotes(records).slice(0, 5), [records]);

  if (!recent.length) return <EmptyState compact text="No notes yet. Capture one and it shows up here." />;
  return (
    <List
      size="small"
      split={false}
      dataSource={recent}
      renderItem={(note) => (
        <List.Item style={{ paddingInline: 0 }}>
          <Flex justify="space-between" align="baseline" gap={12} style={{ width: "100%" }}>
            <Link to="/notes" style={{ minWidth: 0 }}>
              <Typography.Text ellipsis>{noteDisplayTitle(note)}</Typography.Text>
            </Link>
            <span className="pp-label pp-num" style={{ fontSize: 11, flex: "none" }}>
              {new Date(note.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </span>
          </Flex>
        </List.Item>
      )}
    />
  );
}
