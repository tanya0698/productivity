import { defineMobileModule } from "../../../shared/modules/types";
import ProjectsScreen from "../screens/ProjectsScreen";
import SummaryWidget from "../widgets/SummaryWidget";

export default defineMobileModule({
  key: "projects",
  name: "Projects",
  description: "Group tasks and notes around an outcome",
  icon: "folder-open",
  tabOrder: 5,
  entities: ["project"],
  screen: ProjectsScreen,
  widgets: [{ id: "summary", title: "Projects", order: 30, component: SummaryWidget }],
  status: "live",
});
