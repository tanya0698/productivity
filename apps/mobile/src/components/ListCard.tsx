import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Text from "./Text";
import { radii, usePalette } from "../theme";

/** A solid content card with an optional mono label and count/action on the right. */
export function Card({
  title,
  right,
  children,
  style,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }, style]}>
      {title ? (
        <View style={styles.head}>
          <Text label>{title}</Text>
          {typeof right === "string" ? <Text label>{right}</Text> : right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** A tappable row inside a Card: icon, title, optional detail, chevron. */
export function LinkRow({
  icon,
  title,
  detail,
  onPress,
  first = false,
  disabled = false,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  detail?: string;
  onPress?: () => void;
  first?: boolean;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: p.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
      ]}
    >
      {icon ? (
        <View style={[styles.icon, { backgroundColor: p.primarySoft }]}>
          <Ionicons name={icon} size={18} color={p.primaryStrong} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="medium">{title}</Text>
        {detail ? (
          <Text tone="secondary" style={{ fontSize: 12 }} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {onPress && !disabled ? <Ionicons name="chevron-forward" size={16} color={p.textMuted} /> : null}
    </Pressable>
  );
}

/** A small text link at the foot of a card ("All tasks"). */
export function FootLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={{ paddingVertical: 10 }}>
      <Text tone="brand" weight="semiBold" style={{ fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 14, paddingBottom: 4 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  icon: { width: 34, height: 34, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
});
