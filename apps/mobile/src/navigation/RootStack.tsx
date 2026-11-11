import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { modules } from "../features/registry";
import AccountScreen from "../screens/AccountScreen";
import MainTabs from "./MainTabs";
import { pushed } from "./pushed";

const Stack = createNativeStackNavigator();

/**
 * The tabs at the bottom, with every module that has no tab (and the account)
 * pushed over them from More. Route names are the module keys, so any screen
 * can `go("habits")` (navigation/ref) whether that module is a tab or not.
 */
const screens = modules
  .filter((m) => m.status !== "soon" && m.tabOrder === undefined)
  .map((m) => ({ key: m.key, title: m.name, component: pushed(m.screen) }));
const Account = pushed(AccountScreen);

export default function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="main" component={MainTabs} />
      <Stack.Screen name="account" component={Account} options={{ title: "Account" }} />
      {screens.map((s) => (
        <Stack.Screen key={s.key} name={s.key} component={s.component} options={{ title: s.title }} />
      ))}
    </Stack.Navigator>
  );
}
