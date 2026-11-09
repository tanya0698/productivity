/**
 * The module's manifest. Creating this file inside src/features/<key>/config/
 * registers the module — src/features/registry.ts finds every one.
 *
 * Import defineModule from "@/shared/modules/types", not "@/shared": the
 * registry loads manifests eagerly, and "@/shared" imports the registry.
 */
import { CalendarOutlined } from "@ant-design/icons";
import { defineModule } from "@/shared/modules/types";

export default defineModule({
  key: "calendar",
  name: "Calendar",
  description: "Events and dated tasks by month, week, day or as an agenda",
  icon: <CalendarOutlined />,
  basePath: "/calendar",
  order: 12,
  entities: ["event", "event_exception"],
  widgets: [
    { id: "summary", title: "Today's schedule", span: 12, load: () => import("../widgets/SummaryWidget") },
  ],
  load: () => import("../index"),
  status: "live",
});
