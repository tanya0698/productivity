/**
 * The module's manifest. Creating this file inside src/features/<key>/config/
 * registers the module — src/features/registry.ts finds every one.
 *
 * Import defineModule from "@/shared/modules/types", not "@/shared": the
 * registry loads manifests eagerly, and "@/shared" imports the registry.
 */
import { HourglassOutlined } from "@ant-design/icons";
import { defineModule } from "@/shared/modules/types";

export default defineModule({
  key: "focus",
  name: "Focus",
  description: "A focus timer with breaks, and a history of your sessions",
  icon: <HourglassOutlined />,
  basePath: "/focus",
  order: 35,
  entities: ["focus_session"],
  widgets: [{ id: "summary", title: "Focus", span: 12, load: () => import("../widgets/SummaryWidget") }],
  load: () => import("../index"),
  status: "live",
});
