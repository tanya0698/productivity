import { defineMobileModule } from "../../../shared/modules/types";
import ReportsScreen from "../screens/ReportsScreen";

export default defineMobileModule({
  key: "reports",
  name: "Reports",
  description: "How a period went, compared with the one before",
  icon: "stats-chart",
  entities: [],
  screen: ReportsScreen,
  status: "live",
});
