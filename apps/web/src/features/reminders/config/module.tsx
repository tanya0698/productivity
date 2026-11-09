/**
 * The module's manifest. Creating this file inside src/features/<key>/config/
 * registers the module — src/features/registry.ts finds every one.
 *
 * Import defineModule from "@/shared/modules/types", not "@/shared": the
 * registry loads manifests eagerly, and "@/shared" imports the registry.
 */
import { BellOutlined } from "@ant-design/icons";
import { defineModule } from "@/shared/modules/types";

export default defineModule({
  key: "reminders",
  name: "Reminders",
  description: "One-off and repeating reminders, on their own or on a task",
  icon: <BellOutlined />,
  basePath: "/reminders",
  order: 25,
  entities: ["reminder"],
  widgets: [
    { id: "summary", title: "Reminders", span: 12, load: () => import("../widgets/SummaryWidget") },
  ],
  load: () => import("../index"),
  status: "live",
});
