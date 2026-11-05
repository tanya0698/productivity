import { defineMobileModule } from "../../../shared/modules/types";
import TasksScreen from "../screens/TasksScreen";

export default defineMobileModule({
  key: "tasks",
  name: "Tasks",
  icon: "checkbox",
  tabOrder: 10,
  entities: ["task"],
  screen: TasksScreen,
  status: "live",
});
