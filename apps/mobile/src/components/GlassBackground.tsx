import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { usePalette } from "../theme";

/**
 * The teal-tinted gradient into the ink behind screen headers.
 * Content below it sits on solid `palette.page` — glass and gradient are for
 * the frame only (plan §4.4).
 */
export default function GlassBackground({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  return (
    <LinearGradient colors={p.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {children}
    </LinearGradient>
  );
}
