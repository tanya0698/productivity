import { useMemo } from "react";
import { Empty, List, Typography } from "antd";
import { Link } from "react-router-dom";
import { noteDisplayTitle, sortNotes, type LocalNote } from "@productivity/domain";
import { useLocalRecords } from "@/shared";

/** The Today page's "Recent notes" panel. */
export default function SummaryWidget() {
  const { records } = useLocalRecords<LocalNote & { deletedAt: string | null }>("note");
  const recent = useMemo(() => sortNotes(records).slice(0, 5), [records]);

  if (!recent.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No notes yet." />;
  }
  return (
    <List
      size="small"
      dataSource={recent}
      renderItem={(note) => (
        <List.Item style={{ paddingInline: 0 }}>
          <Link to="/notes">
            <Typography.Text>{noteDisplayTitle(note)}</Typography.Text>
          </Link>
        </List.Item>
      )}
    />
  );
}
