import { Card, Empty } from "antd";
import { ModulePage } from "@/shared";

/**
 * The module's main page. Synced records will come from the local database
 * (plan §11.3) so the page works offline; until that lands it shows the empty
 * state the real list falls back to.
 */
export default function HomePage() {
  return (
    <ModulePage title="Notes" description="Quick notes and longer writing, linked to tasks and projects">
      <Card>
        <Empty description="No notes yet. Notes are saved on this device first and sync when you are online." />
      </Card>
    </ModulePage>
  );
}