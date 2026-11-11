import { defineMobileModule } from "../../../shared/modules/types";
import FocusScreen from "../screens/FocusScreen";
import SummaryWidget from "../widgets/SummaryWidget";

export default defineMobileModule({
  key: "focus",
  name: "Focus",
  description: "A focus timer with breaks, and your sessions",
  icon: "timer",
  entities: ["focus_session"],
  screen: FocusScreen,
  widgets: [{ id: "summary", title: "Focus", order: 35, component: SummaryWidget }],
  status: "live",
});
