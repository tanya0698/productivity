import { defineMobileModule } from "../../../shared/modules/types";
import NotesScreen from "../screens/NotesScreen";

export default defineMobileModule({
  key: "notes",
  name: "Notes",
  icon: "document-text",
  tabOrder: 20,
  entities: ["note"],
  screen: NotesScreen,
  status: "live",
});
