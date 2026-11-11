import React from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "./GlassCard";
import { useColorMode, usePalette, type ColorMode } from "../theme";

const NEXT: Record<ColorMode, ColorMode> = { system: "light", light: "dark", dark: "system" };
const ICON = { system: "phone-portrait-outline", light: "sunny-outline", dark: "moon-outline" } as const;
const LABEL = { system: "Following the phone", light: "Light", dark: "Dark" };

/** A small round switch for screens without More (sign-in): System → Light → Dark. */
export default function ModeButton() {
  const p = usePalette();
  const { mode, setMode } = useColorMode();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Appearance: ${LABEL[mode]}. Tap to change.`}
      hitSlop={8}
      onPress={() => setMode(NEXT[mode])}
    >
      <GlassCard style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={ICON[mode]} size={18} color={p.text} />
      </GlassCard>
    </Pressable>
  );
}
