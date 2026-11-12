import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePalette, radii } from "../theme";

const CIRCLE = 40;

export type TabIcons = Record<string, keyof typeof Ionicons.glyphMap>;

/**
 * park-check's floating glass pill: icons only, active tab as a solid primary
 * circle. Custom rather than the library's default bar so centring and the
 * glass fill are exact. No `elevation` — see GlassCard.tsx.
 *
 * Built as park-check builds it, because Android draws rounded translucent
 * views unevenly otherwise: the pill's tint and border are separate layers
 * that each carry the radius, and each icon circle clips to itself
 * (overflow: hidden), or its fill can render as a square.
 */
export function makeGlassTabBar(icons: TabIcons) {
  return function GlassTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
    const p = usePalette();
    const insets = useSafeAreaInsets();
    return (
      <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 12) + 8 }]} pointerEvents="box-none">
        <View style={styles.pill}>
          <View style={[styles.layer, { backgroundColor: p.glass.fillStrong }]} />
          <View style={[styles.layer, { borderWidth: 1, borderColor: p.glass.border }]} />
          <View style={styles.row}>
            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const base = icons[route.name] ?? "ellipse";
              const name = (focused ? base : `${base}-outline`) as keyof typeof Ionicons.glyphMap;
              const label = descriptors[route.key]?.options.title ?? route.name;
              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: focused }}
                  style={styles.item}
                  onPress={() => {
                    const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                    if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
                  }}
                >
                  <View style={[styles.circle, focused && { backgroundColor: p.primary }]}>
                    <Ionicons name={name} size={22} color={focused ? p.onPrimary : p.textSecondary} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    );
  };
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", left: 20, right: 20, height: 64 },
  pill: { flex: 1, borderRadius: radii.pill },
  layer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radii.pill },
  row: { flex: 1, flexDirection: "row" },
  item: { flex: 1, alignItems: "center", justifyContent: "center" },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
