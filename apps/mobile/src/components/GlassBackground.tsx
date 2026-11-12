import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { usePalette } from "../theme";

/**
 * The coloured wash every screen sits on: a teal-to-indigo gradient with two
 * soft glows, the base layer that makes the glass panels above it read as
 * glass (there has to be colour underneath to show through). `glows` adds the
 * two blobs; they stay put while content scrolls over them.
 */
export default function GlassBackground({
  children,
  style,
  glows = false,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glows?: boolean;
}) {
  const p = usePalette();
  return (
    <LinearGradient colors={p.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {glows ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.glow, { top: 120, left: -110, backgroundColor: p.glows[0] }]} />
          <View style={[styles.glow, { top: 420, right: -130, backgroundColor: p.glows[1] }]} />
          <View style={[styles.glow, { bottom: -120, left: 40, width: 240, height: 240, borderRadius: 120, backgroundColor: p.glows[0] }]} />
        </View>
      ) : null}
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Big soft circles; the gradient's own softness carries the "blur".
  glow: { position: "absolute", width: 320, height: 320, borderRadius: 160 },
});
