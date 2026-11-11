import React, { useCallback } from "react";
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
import RootStack from "./src/navigation/RootStack";
import SignInScreen from "./src/screens/SignInScreen";
import MfaChallengeScreen from "./src/screens/MfaChallengeScreen";
import { AuthProvider, useAuth } from "./src/shared/auth/AuthProvider";
import { PendingAvatarUpload } from "./src/shared/auth/PendingAvatarUpload";
import { supabase } from "./src/shared/auth/supabase";
import { openRuntime } from "./src/shared/data/openRuntime";
import { SyncTriggers } from "./src/shared/data/SyncTriggers";
import { FocusProvider } from "./src/shared/focus/FocusProvider";
import { ReminderNotifications } from "./src/shared/reminders/ReminderNotifications";
import { navigationRef } from "./src/navigation/ref";
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
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootStack />
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
        {!fontsLoaded ? (
          <Loading />
        ) : supabase ? (
          <AuthProvider client={supabase}>
            <SignedIn />
          </AuthProvider>
        ) : (
          <Message
            title="Sign-in isn't set up yet"
            body="Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to apps/mobile/.env (see .env.example), then restart Expo."
          />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Signed out → the sign-in screen. Signed in → that account's local data and sync. */
function SignedIn() {
  const { ready, session, needsMfa, getAccessToken } = useAuth();
  const userId = session?.user.id;
  const open = useCallback(() => openRuntime(userId!, getAccessToken), [userId, getAccessToken]);

  if (!ready) return <Loading />;
  if (!userId) return <SignInScreen />;
  if (needsMfa) return <MfaChallengeScreen />;
  return (
    // key: switching accounts tears down one account's runtime before opening the next.
    <SyncProvider
      key={userId}
      open={open}
      loading={<Loading />}
      failed={() => (
        <Message
          title="Your notes couldn't be opened"
          body="The app's storage on this phone failed to open. Restart the app to try again."
        />
      )}
    >
      <SyncTriggers />
      <ReminderNotifications />
      <PendingAvatarUpload />
      <FocusProvider>
        <Root />
      </FocusProvider>
    </SyncProvider>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 6 }}>
      <Text weight="semiBold" tone="heading">
        {title}
      </Text>
      <Text tone="secondary" style={{ textAlign: "center" }}>
        {body}
      </Text>
    </View>
  );
}
