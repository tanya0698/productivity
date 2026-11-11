import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlassBackground from "./GlassBackground";
import GlassCard from "./GlassCard";
import { Reveal, RevealProvider, useRevealScope } from "./Motion";
import SyncPill from "./SyncPill";
import Text from "./Text";
import { useIsPushed } from "../navigation/pushed";
import { go } from "../navigation/ref";
import { usePalette, radii } from "../theme";

/**
 * Every screen's frame: gradient header with title and an optional glass
 * capture area, then a solid sheet for the content (plan §4.4). Screens pushed
 * from More get a back button; tab screens leave room for the tab bar.
 */
export default function ScreenFrame({
  eyebrow,
  title,
  capturePlaceholder,
  capture,
  onBack,
  searchable = true,
  children,
}: {
  eyebrow?: string;
  title: string;
  /** Static hint text in the glass field. */
  capturePlaceholder?: string;
  /** A live capture control in place of the hint. */
  capture?: React.ReactNode;
  /** Overrides the back button (e.g. closing an editor inside the screen). */
  onBack?: () => void;
  /** Shows the search button in the header (off on the search screen itself). */
  searchable?: boolean;
  children: React.ReactNode;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isPushed = useIsPushed();
  const back = onBack ?? (isPushed ? () => navigation.goBack() : undefined);
  const { scope, scrollProps } = useRevealScope();
  return (
    <View style={{ flex: 1, backgroundColor: p.page }}>
      <GlassBackground style={{ paddingTop: insets.top + 8, paddingBottom: 26, paddingHorizontal: 16 }}>
        <View style={styles.eyebrowRow}>
          {back ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={back} style={styles.back}>
              <Ionicons name="chevron-back" size={18} color={p.primary} />
            </Pressable>
          ) : null}
          {eyebrow ? <Text label tone="brand">{eyebrow}</Text> : null}
        </View>
        <View style={styles.titleRow}>
          <Text weight="extraBold" tone="heading" style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.actions}>
            {searchable ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Search everything" hitSlop={10} onPress={() => go("search")}>
                <Ionicons name="search" size={20} color={p.text} />
              </Pressable>
            ) : null}
            <SyncPill />
          </View>
        </View>
        {capture ? (
          <GlassCard strong style={styles.captureLive}>
            {capture}
          </GlassCard>
        ) : capturePlaceholder ? (
          <GlassCard strong style={styles.capture}>
            <Text tone="secondary">{capturePlaceholder}</Text>
          </GlassCard>
        ) : null}
      </GlassBackground>
      <ScrollView
        style={[styles.sheet, { backgroundColor: p.page }]}
        keyboardShouldPersistTaps="handled"
        {...scrollProps}
        // Room for the floating tab bar on tab screens.
        contentContainerStyle={{ padding: 12, paddingBottom: isPushed ? insets.bottom + 32 : 110, gap: 10 }}
      >
        {/* Each block comes in as it scrolls into view, every time (the web's scroll reveal). */}
        <RevealProvider scope={scope}>
          {React.Children.toArray(children).map((child, i) => (
            <Reveal key={React.isValidElement(child) && child.key != null ? child.key : i}>{child}</Reveal>
          ))}
        </RevealProvider>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: 14 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, minHeight: 18 },
  back: { marginLeft: -4 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  title: { fontSize: 30, letterSpacing: -0.6, flexShrink: 1 },
  capture: { paddingHorizontal: 12, paddingVertical: 11 },
  captureLive: { paddingHorizontal: 6, paddingVertical: 5 },
  sheet: { flex: 1, marginTop: -14, borderTopLeftRadius: radii.lg + 2, borderTopRightRadius: radii.lg + 2 },
});
