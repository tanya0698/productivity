import { defineMobileModule } from "../../../shared/modules/types";
import GoalsScreen from "../screens/GoalsScreen";

export default defineMobileModule({
  key: "goals",
  name: "Goals",
  description: "Outcomes with milestones, linked projects and habits",
  icon: "flag",
  entities: ["goal", "goal_milestone"],
  screen: GoalsScreen,
  status: "live",
});
