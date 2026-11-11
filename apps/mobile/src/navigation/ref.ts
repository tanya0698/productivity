import { createNavigationContainerRef } from "@react-navigation/native";

/** For navigating from anywhere, including outside a screen (a tapped notification). */
export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

/**
 * Go to a screen by name, whether it is pushed over the tabs (projects,
 * reminders, account) or is a tab itself (today, tasks, calendar, notes, more).
 * React Navigation 7 won't find a tab by name from the root stack, so tabs
 * are reached through "main".
 */
export function go(name: string, params?: object) {
  if (!navigationRef.isReady()) return;
  const root = navigationRef.getRootState();
  if (root?.routeNames.includes(name)) navigationRef.navigate(name, params);
  else navigationRef.navigate("main", { screen: name, params });
}

/** Navigate once the navigator is up; a notification can open the app before it is. */
export function navigateWhenReady(name: string, params?: object, tries = 40) {
  if (navigationRef.isReady()) go(name, params);
  else if (tries > 0) setTimeout(() => navigateWhenReady(name, params, tries - 1), 100);
}
