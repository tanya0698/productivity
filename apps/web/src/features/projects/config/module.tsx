/**
 * The module's manifest. Creating this file inside src/features/<key>/config/
 * registers the module — src/features/registry.ts finds every one.
 *
 * Import defineModule from "@/shared/modules/types", not "@/shared": the
 * registry loads manifests eagerly, and "@/shared" imports the registry.
 */
import { ProjectOutlined } from "@ant-design/icons";
import { defineModule } from "@/shared/modules/types";

export default defineModule({
  key: "projects",
  name: "Projects",
  description: "Group tasks and notes around an outcome, and see how far along it is",
  icon: <ProjectOutlined />,
  basePath: "/projects",
  order: 15,
  entities: ["project"],
  widgets: [
    { id: "summary", title: "Projects", span: 12, load: () => import("../widgets/SummaryWidget") },
  ],
  load: () => import("../index"),
  status: "live",
});
