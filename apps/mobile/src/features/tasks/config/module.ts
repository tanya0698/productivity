import { defineMobileModule } from "../../../shared/modules/types";
import TasksScreen from "../screens/TasksScreen";
import TodayWidget from "../widgets/TodayWidget";

export default defineMobileModule({
  key: "tasks",
  name: "Tasks",
  description: "To-dos with due dates and priorities",
  icon: "checkbox",
  tabOrder: 10,
  entities: ["task"],
  screen: TasksScreen,
  widgets: [{ id: "due", title: "Due today", order: 10, component: TodayWidget }],
  status: "live",
});
