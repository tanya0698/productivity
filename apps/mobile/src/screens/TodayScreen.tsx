import React from "react";
import { Pressable, View } from "react-native";
import ScreenFrame from "../components/ScreenFrame";
import EmptyState from "../components/EmptyState";
import Text from "../components/Text";
import { useAuth } from "../shared/auth/AuthProvider";
import { radii, usePalette } from "../theme";

/**
 * Today — the shell's home screen, like the web app's Today page. Modules will
 * contribute panels here (overdue tasks, next event, reminders) as they land.
 * The account and sign-out live at the bottom until there's a settings screen.
 */
export default function TodayScreen() {
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  return (
    <ScreenFrame eyebrow={date} title="Today" capturePlaceholder="Capture a task, note or reminder…">
      <EmptyState
        title="Nothing scheduled yet"
        body="Tasks due today, your next event and reminders will appear here once the Tasks module stores data on this phone."
      />
      <AccountCard />
    </ScreenFrame>
  );
}

function AccountCard() {
  const { session, signOut } = useAuth();
  const p = usePalette();
  return (
    <View style={{ borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, borderRadius: radii.lg, padding: 16, gap: 6 }}>
      <Text label>Signed in as</Text>
      <Text numberOfLines={1}>{session?.user.email ?? "Unknown account"}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void signOut()}
        style={{ alignSelf: "flex-start", marginTop: 6, borderWidth: 1, borderColor: p.borderStrong, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 6 }}
      >
        <Text weight="medium">Sign out</Text>
      </Pressable>
    </View>
  );
}
