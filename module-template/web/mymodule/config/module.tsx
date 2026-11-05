/**
 * The module's manifest. Creating this file inside src/features/<key>/config/
 * registers the module — src/features/registry.ts finds every one.
 *
 * Copy module-template/web/mymodule to apps/web/src/features/<key>/ and replace
 * `mymodule` / `MyModule` (case-sensitive). The key must equal the folder name
 * and the mobile and API module keys.
 *
 * Import defineModule from "@/shared/modules/types", not "@/shared": the
 * registry loads manifests eagerly, and "@/shared" imports the registry.
 */
import { AppstoreOutlined } from "@ant-design/icons";
import { defineModule } from "@/shared/modules/types";

export default defineModule({
  key: "mymodule",
  name: "MyModule",
  description: "One line saying what this module is for",
  icon: <AppstoreOutlined />,
  basePath: "/mymodule",
  order: 100,
  entities: [],
  widgets: [
    { id: "summary", title: "MyModule", span: 12, load: () => import("../widgets/SummaryWidget") },
  ],
  load: () => import("../index"),
  status: "live",
});