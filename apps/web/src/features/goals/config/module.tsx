/**
 * The module's manifest. Creating this file inside src/features/<key>/config/
 * registers the module — src/features/registry.ts finds every one.
 *
 * Import defineModule from "@/shared/modules/types", not "@/shared": the
 * registry loads manifests eagerly, and "@/shared" imports the registry.
 */
import { AimOutlined } from "@ant-design/icons";
import { defineModule } from "@/shared/modules/types";

export default defineModule({
  key: "goals",
  name: "Goals",
  description: "Outcomes with milestones, linked projects and habits, and regular reviews",
  icon: <AimOutlined />,
  basePath: "/goals",
  order: 30,
  entities: ["goal", "goal_milestone"],
  load: () => import("../index"),
  status: "live",
});
