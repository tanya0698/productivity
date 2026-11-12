import React, { createContext, useContext, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "../shared/motion/useReducedMotion";
import { radii, usePalette } from "../theme";

/**
 * Skeletons shaped like what's coming: tiles, rows, cards. Shown while data
 * loads or before this phone's first sync, as on the web. A soft pulse runs
 * through them (still with reduced motion). Screen readers hear "Loading".
 *
 * All bones in one skeleton share one animation, so they pulse together.
 */
const Pulse = createContext<Animated.Value | null>(null);

function PulseProvider({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return v.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, v]);
  return <Pulse.Provider value={v}>{children}</Pulse.Provider>;
}

/** One block. */
export function Bone({ w = "100%", h = 12, r = 6, style }: { w?: DimensionValue; h?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  const pulse = useContext(Pulse);
  const opacity = pulse ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) : 1;
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: p.muted, opacity }, style]} />;
}

/** A skeleton's wrapper: one shared pulse, and "Loading …" for screen readers. */
function Loading({ what, children, style }: { what: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <PulseProvider>
      <View accessible accessibilityLabel={`Loading ${what}…`} accessibilityState={{ busy: true }} style={style}>
        {children}
      </View>
    </PulseProvider>
  );
}

// Varied widths, the same every render, so it reads as text rather than bars.
const WIDTHS: DimensionValue[] = ["62%", "48%", "71%", "39%", "56%", "66%", "44%"];

/** One entity card's outline: icon tile and two lines, a value with its pill, and a ring. */
function EntityBones({ ring, i }: { ring: boolean; i: number }) {
  const p = usePalette();
  return (
    <View style={[styles.entity, { backgroundColor: p.surface, borderColor: p.cardBorder }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Bone w={38} h={38} r={10} />
        <View style={{ flex: 1, gap: 7 }}>
          <Bone w={WIDTHS[(i + 2) % WIDTHS.length]} h={11} />
          <Bone w="40%" h={8} />
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto" }}>
        <View style={{ gap: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Bone w={54} h={22} r={7} />
            <Bone w={36} h={16} r={999} />
          </View>
          <Bone w={90} h={8} />
        </View>
        {ring ? <Bone w={44} h={44} r={22} /> : null}
      </View>
    </View>
  );
}

/** Stat cards, two to a row (an odd one full width), like StatRow. */
export function TileRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Loading what="figures" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flexBasis: "46%", flexGrow: 1 }}>
          <EntityBones ring={i % 2 === 0} i={i} />
        </View>
      ))}
    </Loading>
  );
}

/** Rows like tasks, habits or reminders: a round check, a title and a meta line. Use inside a card. */
export function RowsSkeleton({ rows = 4, check = true }: { rows?: number; check?: boolean }) {
  return (
    <Loading what="items" style={{ paddingBottom: 8 }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          {check ? <Bone w={22} h={22} r={11} /> : null}
          <View style={{ flex: 1, gap: 8 }}>
            <Bone w={WIDTHS[i % WIDTHS.length]} h={12} />
            <Bone w="24%" h={9} />
          </View>
        </View>
      ))}
    </Loading>
  );
}

/** A card with a title bar and rows inside. */
export function ListCardSkeleton({ rows = 4, check = true }: { rows?: number; check?: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.cardBorder }]}>
      <PulseProvider>
        <Bone w={110} h={10} style={{ marginVertical: 14 }} />
      </PulseProvider>
      <RowsSkeleton rows={rows} check={check} />
    </View>
  );
}

/** Cards like projects or goals: entity cards, one per row. */
export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Loading what="cards" style={{ gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <EntityBones key={i} ring i={i} />
      ))}
    </Loading>
  );
}

const styles = StyleSheet.create({
  entity: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 16, gap: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  card: { borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 14 },
});
