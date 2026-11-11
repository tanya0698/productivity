import { defineMobileModule } from "../../../shared/modules/types";
import RemindersScreen from "../screens/RemindersScreen";
import RemindersWidget from "../widgets/RemindersWidget";

export default defineMobileModule({
  key: "reminders",
  name: "Reminders",
  description: "One-off or repeating alerts, as notifications",
  icon: "notifications",
  entities: ["reminder"],
  screen: RemindersScreen,
  widgets: [{ id: "next", title: "Reminders", order: 20, component: RemindersWidget }],
  status: "live",
});
