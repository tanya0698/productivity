/**
 * Copy this folder to apps/mobile/src/features/<key>/ and replace
 * `mymodule` / `MyModule` (case-sensitive). The key must match the web module
 * and the API module. `npm start` regenerates the registry, so the new tab
 * appears with no other edit.
 */
import { defineMobileModule } from "../../../shared/modules/types";
import MyModuleScreen from "../screens/MyModuleScreen";

export default defineMobileModule({
  key: "mymodule",
  name: "MyModule",
  icon: "apps",
  // Remove to list the module under More instead of giving it a tab.
  tabOrder: 100,
  entities: [],
  screen: MyModuleScreen,
  status: "live",
});
