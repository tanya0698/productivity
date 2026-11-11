import { createNavigationContainerRef } from "@react-navigation/native";

/** For navigating from outside a screen (a tapped notification). */
export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

/** Navigate once the navigator is up; a notification can open the app before it is. */
export function navigateWhenReady(name: string, params?: object, tries = 40) {
  if (navigationRef.isReady()) navigationRef.navigate(name, params);
  else if (tries > 0) setTimeout(() => navigateWhenReady(name, params, tries - 1), 100);
}
