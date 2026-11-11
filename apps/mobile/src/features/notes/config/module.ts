import { defineMobileModule } from "../../../shared/modules/types";
import NotesScreen from "../screens/NotesScreen";
import RecentNotesWidget from "../widgets/RecentNotesWidget";

export default defineMobileModule({
  key: "notes",
  name: "Notes",
  description: "Quick notes and longer writing",
  icon: "document-text",
  tabOrder: 20,
  entities: ["note"],
  screen: NotesScreen,
  widgets: [{ id: "recent", title: "Recent notes", order: 90, component: RecentNotesWidget }],
  status: "live",
});
