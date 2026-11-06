import { Card, Empty } from "antd";
import { ModulePage } from "@/shared";

/**
 * The module's main page. Synced records will come from the local database
 * (plan §11.3) so the page works offline; until that lands it shows the empty
 * state the real list falls back to.
 */
export default function HomePage() {
  return (
    <ModulePage eyebrow="Section" title="MyModule" description="One line saying what this module is for">
      <Card>
        <Empty description="Nothing here yet. Items you add on any device will appear here." />
      </Card>
    </ModulePage>
  );
}