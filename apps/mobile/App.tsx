import React from "react";
import { ActivityIndicator, View, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
// One module per weight: the packages' index files would bundle every weight and italic (~6 MB).
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Inter_800ExtraBold } from "@expo-google-fonts/inter/800ExtraBold";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono/700Bold";
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
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
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
