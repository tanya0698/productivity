import React, { useMemo } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { modules } from "../features/registry";
import TodayScreen from "../screens/TodayScreen";
import { makeGlassTabBar, type TabIcons } from "./GlassTabBar";

const Tab = createBottomTabNavigator();

/**
 * Today, then every live module that asks for a tab, in `tabOrder`.
 * Built from the generated registry, so adding a module folder adds its tab.
 */
export default function MainTabs() {
  const tabs = useMemo(
    () =>
      modules
        .filter((m) => m.status !== "soon" && m.tabOrder !== undefined)
        .sort((a, b) => (a.tabOrder ?? 0) - (b.tabOrder ?? 0)),
    [],
  );
  const TabBar = useMemo(() => {
    const icons: TabIcons = { today: "sunny" };
    for (const m of tabs) icons[m.key] = m.icon;
    return makeGlassTabBar(icons);
  }, [tabs]);

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="today" component={TodayScreen} options={{ title: "Today" }} />
      {tabs.map((m) => (
        <Tab.Screen key={m.key} name={m.key} component={m.screen} options={{ title: m.name }} />
      ))}
    </Tab.Navigator>
  );
}
