import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlassBackground from "./GlassBackground";
import GlassCard from "./GlassCard";
import Text from "./Text";
import { usePalette, radii } from "../theme";

/**
 * Every tab screen's frame: gradient header with title and optional glass
 * capture field, then a solid sheet for the content (plan §4.4).
 */
export default function ScreenFrame({
  eyebrow,
  title,
  capturePlaceholder,
  children,
}: {
  eyebrow?: string;
  title: string;
  capturePlaceholder?: string;
  children: React.ReactNode;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: p.page }}>
      <GlassBackground style={{ paddingTop: insets.top + 8, paddingBottom: 26, paddingHorizontal: 16 }}>
        {eyebrow ? <Text tone="secondary" style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text weight="extraBold" style={styles.title}>{title}</Text>
        {capturePlaceholder ? (
          <GlassCard strong style={styles.capture}>
            <Text tone="secondary">{capturePlaceholder}</Text>
          </GlassCard>
        ) : null}
      </GlassBackground>
      <ScrollView
        style={[styles.sheet, { backgroundColor: p.page }]}
        // Room for the floating tab bar.
        contentContainerStyle={{ padding: 12, paddingBottom: 110, gap: 10 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 12 },
  title: { fontSize: 26, letterSpacing: -0.3, marginBottom: 12 },
  capture: { paddingHorizontal: 12, paddingVertical: 11 },
  sheet: { flex: 1, marginTop: -14, borderTopLeftRadius: radii.lg + 2, borderTopRightRadius: radii.lg + 2 },
});
