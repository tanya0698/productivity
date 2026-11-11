import { defineMobileModule } from "../../../shared/modules/types";
import HabitsScreen from "../screens/HabitsScreen";
import SummaryWidget from "../widgets/SummaryWidget";

export default defineMobileModule({
  key: "habits",
  name: "Habits",
  description: "Daily and weekly habits with streaks",
  icon: "checkmark-done-circle",
  entities: ["habit", "habit_log"],
  screen: HabitsScreen,
  widgets: [{ id: "summary", title: "Habits today", order: 25, component: SummaryWidget }],
  status: "live",
});
