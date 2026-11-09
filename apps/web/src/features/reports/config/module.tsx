/**
 * The module's manifest. Creating this file inside src/features/<key>/config/
 * registers the module — src/features/registry.ts finds every one.
 *
 * Import defineModule from "@/shared/modules/types", not "@/shared": the
 * registry loads manifests eagerly, and "@/shared" imports the registry.
 */
import { BarChartOutlined } from "@ant-design/icons";
import { defineModule } from "@/shared/modules/types";

export default defineModule({
  key: "reports",
  name: "Reports",
  description: "How a period went across tasks, focus, habits, projects and goals; export as CSV or PDF",
  icon: <BarChartOutlined />,
  basePath: "/reports",
  order: 40,
  load: () => import("../index"),
  status: "live",
});
