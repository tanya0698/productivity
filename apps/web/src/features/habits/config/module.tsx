/**
 * The module's manifest. Creating this file inside src/features/<key>/config/
 * registers the module — src/features/registry.ts finds every one.
 *
 * Import defineModule from "@/shared/modules/types", not "@/shared": the
 * registry loads manifests eagerly, and "@/shared" imports the registry.
 */
import { CheckCircleOutlined } from "@ant-design/icons";
import { defineModule } from "@/shared/modules/types";

export default defineModule({
  key: "habits",
  name: "Habits",
  description: "Daily and weekly habits with streaks and flexible targets",
  icon: <CheckCircleOutlined />,
  basePath: "/habits",
  order: 32,
  entities: ["habit", "habit_log"],
  widgets: [{ id: "summary", title: "Habits today", span: 12, load: () => import("../widgets/SummaryWidget") }],
  load: () => import("../index"),
  status: "live",
});
