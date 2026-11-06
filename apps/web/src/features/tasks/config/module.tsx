/**
 * The module's manifest. Creating this file inside src/features/<key>/config/
 * registers the module — src/features/registry.ts finds every one.
 *
 * Copy module-template/web/tasks to apps/web/src/features/<key>/ and replace
 * `tasks` / `Tasks` (case-sensitive). The key must equal the folder name
 * and the mobile and API module keys.
 *
 * Import defineModule from "@/shared/modules/types", not "@/shared": the
 * registry loads manifests eagerly, and "@/shared" imports the registry.
 */
import { CheckSquareOutlined } from "@ant-design/icons";
import { defineModule } from "@/shared/modules/types";

export default defineModule({
  key: "tasks",
  name: "Tasks",
  description: "Everything you need to do, by due date and project",
  icon: <CheckSquareOutlined />,
  basePath: "/tasks",
  order: 10,
  entities: ["task"],
  widgets: [
    { id: "summary", title: "Up next", span: 12, load: () => import("../widgets/SummaryWidget") },
  ],
  load: () => import("../index"),
  status: "live",
});