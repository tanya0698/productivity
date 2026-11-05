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
import { SyncProvider } from "@productivity/sync-engine/react";
import Text from "./src/components/Text";
import MainTabs from "./src/navigation/MainTabs";
import { openRuntime } from "./src/shared/data/openRuntime";
import { SyncTriggers } from "./src/shared/data/SyncTriggers";
import { ThemeProvider, usePalette } from "./src/theme";

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

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
          <SyncProvider
            open={openRuntime}
            loading={<Loading />}
            failed={() => (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
                <Text weight="semiBold">Your notes couldn't be opened</Text>
                <Text tone="secondary">The app's storage on this phone failed to open. Restart the app to try again.</Text>
              </View>
            )}
          >
            <SyncTriggers />
            <Root />
          </SyncProvider>
        ) : (
          <Loading />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
