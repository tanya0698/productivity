import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppearancePicker from "../components/AppearancePicker";
import Avatar from "../components/Avatar";
import { Card, LinkRow } from "../components/ListCard";
import ScreenFrame from "../components/ScreenFrame";
import Text from "../components/Text";
import { modules } from "../features/registry";
import { useAuth } from "../shared/auth/AuthProvider";
import { displayName } from "../shared/auth/profile";
import { radii, usePalette } from "../theme";
import { go } from "../navigation/ref";

/** Every module without a tab, then the account. */
export default function MoreScreen() {
  const { session } = useAuth();
  const p = usePalette();
  const user = session?.user;
  const rest = modules
    .filter((m) => m.tabOrder === undefined)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ScreenFrame eyebrow="Creedence" title="More">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account"
        onPress={() => go("account")}
        style={({ pressed }) => [
          { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderRadius: radii.lg, backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Avatar user={user} size={46} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="semiBold" numberOfLines={1}>
            {displayName(user) || "Your account"}
          </Text>
          <Text tone="secondary" style={{ fontSize: 12 }} numberOfLines={1}>
            {user?.email ?? ""}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={p.textMuted} />
      </Pressable>

      <Card title="Appearance">
        <AppearancePicker />
      </Card>

      {rest.length ? (
        <Card title="Modules">
          {rest.map((m, i) => (
            <LinkRow
              key={m.key}
              first={i === 0}
              icon={m.icon}
              title={m.name}
              detail={m.status === "soon" ? "Coming to Android" : m.description}
              disabled={m.status === "soon"}
              onPress={() => go(m.key)}
            />
          ))}
        </Card>
      ) : null}
    </ScreenFrame>
  );
}
