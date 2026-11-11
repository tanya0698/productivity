import { defineMobileModule } from "../../../shared/modules/types";
import CalendarScreen from "../screens/CalendarScreen";
import TodayEventsWidget from "../widgets/TodayEventsWidget";

export default defineMobileModule({
  key: "calendar",
  name: "Calendar",
  description: "Events, repeating series and dated tasks",
  icon: "calendar",
  tabOrder: 15,
  entities: ["event", "event_exception"],
  screen: CalendarScreen,
  widgets: [{ id: "today", title: "On the calendar", order: 15, component: TodayEventsWidget }],
  status: "live",
});
