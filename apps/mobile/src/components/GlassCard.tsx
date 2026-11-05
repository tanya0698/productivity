import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { usePalette, radii } from "../theme";

/**
 * A frosted panel for the frame (capture field, header pills). Not for content.
 *
 * Carried over from park-check's GlassCard, including its two Android fixes:
 *  - no expo-blur: it only blurs on Android 12+ and falls back to a flat grey
 *    layer elsewhere. Translucency plus the border highlight reads as glass.
 *  - no `elevation`: Android draws a solid grey rectangle behind translucent
 *    views instead of a soft shadow.
 */
export default function GlassCard({
  children,
  style,
  strong = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** More opaque, for chrome that must stay legible (capture field, tab bar). */
  strong?: boolean;
}) {
  const p = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: strong ? p.glass.fillStrong : p.glass.fill,
          borderColor: p.glass.border,
          borderWidth: 1,
          borderRadius: radii.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
