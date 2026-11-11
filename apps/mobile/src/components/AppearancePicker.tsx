import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Text from "./Text";
import { radii, useColorMode, usePalette, type ColorMode } from "../theme";

const OPTIONS: { value: ColorMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "system", label: "System", icon: "phone-portrait-outline" },
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
];

/** System / Light / Dark, like the toggle in the web app's header. */
export default function AppearancePicker() {
  const p = usePalette();
  const { mode, setMode } = useColorMode();
  return (
    <View accessibilityRole="radiogroup" style={[styles.track, { backgroundColor: p.muted }]}>
      {OPTIONS.map((o) => {
        const on = mode === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => setMode(o.value)}
            style={[styles.option, on && { backgroundColor: p.surface, borderColor: p.border }]}
          >
            <Ionicons name={o.icon} size={16} color={on ? p.primary : p.textSecondary} />
            <Text weight={on ? "semiBold" : "regular"} style={{ fontSize: 13, color: on ? p.text : p.textSecondary }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", borderRadius: radii.md, padding: 3, gap: 3, marginBottom: 10 },
  option: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
});
