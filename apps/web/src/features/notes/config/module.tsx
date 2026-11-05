/**
 * The module's manifest. Creating this file inside src/features/<key>/config/
 * registers the module — src/features/registry.ts finds every one.
 *
 * Copy module-template/web/notes to apps/web/src/features/<key>/ and replace
 * `notes` / `Notes` (case-sensitive). The key must equal the folder name
 * and the mobile and API module keys.
 *
 * Import defineModule from "@/shared/modules/types", not "@/shared": the
 * registry loads manifests eagerly, and "@/shared" imports the registry.
 */
import { FileTextOutlined } from "@ant-design/icons";
import { defineModule } from "@/shared/modules/types";

export default defineModule({
  key: "notes",
  name: "Notes",
  description: "Quick notes and longer writing, linked to tasks and projects",
  icon: <FileTextOutlined />,
  basePath: "/notes",
  order: 20,
  entities: ["note"],
  widgets: [
    { id: "summary", title: "Recent notes", span: 12, load: () => import("../widgets/SummaryWidget") },
  ],
  load: () => import("../index"),
  status: "live",
});