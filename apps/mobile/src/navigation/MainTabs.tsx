import React, { useMemo } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { modules } from "../features/registry";
import MoreScreen from "../screens/MoreScreen";
import TodayScreen from "../screens/TodayScreen";
import { makeGlassTabBar, type TabIcons } from "./GlassTabBar";

const Tab = createBottomTabNavigator();

/** Live modules that ask for a tab, in `tabOrder`. At most three, so the bar stays at five. */
export const tabModules = modules
  .filter((m) => m.status !== "soon" && m.tabOrder !== undefined)
  .sort((a, b) => (a.tabOrder ?? 0) - (b.tabOrder ?? 0))
  .slice(0, 3);

/**
 * Today, the tab modules, then More (every other module, the account and
 * sign-out). Built from the generated registry, so adding a module folder adds
 * it in the right place.
 */
export default function MainTabs() {
  const TabBar = useMemo(() => {
    const icons: TabIcons = { today: "home", more: "grid" };
    for (const m of tabModules) icons[m.key] = m.icon;
    return makeGlassTabBar(icons);
  }, []);

  return (
    <Tab.Navigator
      backBehavior="firstRoute"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tab.Screen name="today" component={TodayScreen} options={{ title: "Today" }} />
      {tabModules.map((m) => (
        <Tab.Screen key={m.key} name={m.key} component={m.screen} options={{ title: m.name }} />
      ))}
      <Tab.Screen name="more" component={MoreScreen} options={{ title: "More" }} />
    </Tab.Navigator>
  );
}
