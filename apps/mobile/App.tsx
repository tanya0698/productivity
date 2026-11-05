import React from "react";
import { ActivityIndicator, View, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import MainTabs from "./src/navigation/MainTabs";
import { ThemeProvider, usePalette } from "./src/theme";

function Root() {
  const p = usePalette();
  const scheme = useColorScheme();
  // Navigation's own background follows the palette, so no white flash between screens.
  const navTheme = {
    ...DefaultTheme,
    dark: scheme === "dark",
    colors: { ...DefaultTheme.colors, background: p.page, card: p.surface, text: p.text, primary: p.primary, border: p.border },
  };
  return (
    <NavigationContainer theme={navTheme}>
      <MainTabs />
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {fontsLoaded ? (
          <Root />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" />
          </View>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
