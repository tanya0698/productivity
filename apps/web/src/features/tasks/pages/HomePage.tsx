import { Card, Empty } from "antd";
import { ModulePage } from "@/shared";

/**
 * The module's main page. Synced records will come from the local database
 * (plan §11.3) so the page works offline; until that lands it shows the empty
 * state the real list falls back to.
 */
export default function HomePage() {
  return (
    <ModulePage title="Tasks" description="Everything you need to do, by due date and project">
      <Card>
        <Empty description="No tasks yet. Tasks you capture here or on your phone will appear here, grouped by due date." />
      </Card>
    </ModulePage>
  );
}