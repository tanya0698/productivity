import React from "react";
import { Alert, Pressable, View } from "react-native";
import Avatar from "../components/Avatar";
import { Card } from "../components/ListCard";
import ScreenFrame from "../components/ScreenFrame";
import Text from "../components/Text";
import { useAuth } from "../shared/auth/AuthProvider";
import { displayName } from "../shared/auth/profile";
import { radii, usePalette } from "../theme";

function Field({ label, value, first }: { label: string; value: string; first?: boolean }) {
  const p = usePalette();
  return (
    <View style={{ paddingVertical: 10, gap: 2, borderTopWidth: first ? 0 : 0.5, borderColor: p.border }}>
      <Text tone="muted" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text>{value}</Text>
    </View>
  );
}

/** Who's signed in, and signing out. */
export default function AccountScreen() {
  const { session, signOut } = useAuth();
  const p = usePalette();
  const user = session?.user;
  const phone = typeof user?.user_metadata?.phone === "string" ? user.user_metadata.phone : "";

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "Anything not synced yet stays on this phone and syncs when you sign back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  return (
    <ScreenFrame eyebrow="Settings" title="Account">
      <View style={{ alignItems: "center", gap: 8, paddingVertical: 12 }}>
        <Avatar user={user} size={84} />
        <Text weight="bold" tone="heading" style={{ fontSize: 20 }}>
          {displayName(user) || "Your account"}
        </Text>
      </View>
      <Card title="Profile">
        <Field first label="Email" value={user?.email ?? "—"} />
        {displayName(user) ? <Field label="Name" value={displayName(user)} /> : null}
        {phone ? <Field label="Phone" value={phone} /> : null}
      </Card>
      <Pressable
        accessibilityRole="button"
        onPress={confirmSignOut}
        style={({ pressed }) => ({ borderWidth: 1, borderColor: p.borderStrong, borderRadius: radii.md, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.7 : 1 })}
      >
        <Text weight="semiBold" style={{ color: p.errorText }}>
          Sign out
        </Text>
      </Pressable>
    </ScreenFrame>
  );
}
