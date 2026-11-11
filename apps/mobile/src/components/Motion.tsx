import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useReducedMotion } from "../shared/motion/useReducedMotion";

/** The web's --pp-ease-out: quick start, soft landing. */
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
/** The web's scroll reveal: 26 px of travel, a slight scale, 0.6 s fade and 0.75 s rise. */
const TRAVEL = 26;
const FADE_MS = 600;
const RISE_MS = 750;
/** How much of a block must be on screen before it comes in. */
const ENTER_RATIO = 0.12;
/** Blocks arriving together stagger by this much (at most 4 steps), as on the web. */
const STAGGER_MS = 70;
/** On opening or returning to a screen, wait for the screen's own transition first. */
const ENTRANCE_DELAY_MS = 180;

type Check = (replay: boolean) => void;

interface Scope {
  /** The visible part of the scroll view: offset and height. */
  view: () => { y: number; h: number };
  subscribe: (check: Check) => () => void;
  /** The delay for the next block to come in, staggering a burst. */
  nextDelay: () => number;
}

const RevealContext = createContext<Scope | null>(null);

/**
 * The scroll reveal for one screen (the mobile twin of the web's
 * ScrollReveal): wrap the screen's ScrollView content in it, and spread the
 * returned props onto the ScrollView. Every block inside a <Reveal> comes in
 * when it scrolls into view, every time, rising from below on the way down
 * and dropping from above on the way up, and the whole screen replays when
 * you come back to it. Nothing moves with reduced motion.
 */
export function useRevealScope() {
  const view = useRef({ y: 0, h: 0 });
  const checks = useRef(new Set<Check>());
  const batch = useRef({ n: 0, timer: 0 as ReturnType<typeof setTimeout> | 0, base: ENTRANCE_DELAY_MS });

  const run = useCallback((replay: boolean) => checks.current.forEach((c) => c(replay)), []);

  const scope = useMemo<Scope>(
    () => ({
      view: () => view.current,
      subscribe: (c) => {
        checks.current.add(c);
        return () => void checks.current.delete(c);
      },
      nextDelay: () => {
        const b = batch.current;
        const delay = b.base + Math.min(b.n++, 4) * STAGGER_MS;
        if (b.timer) clearTimeout(b.timer);
        b.timer = setTimeout(() => {
          b.n = 0;
          b.base = 0; // after the entrance burst, scrolled-in blocks start at once
        }, 120);
        return delay;
      },
    }),
    [],
  );

  // Returning to the screen (tab switch, back from a pushed screen): replay what's on screen.
  const navigation = useNavigation();
  useEffect(() => {
    let first = true;
    return navigation.addListener("focus", () => {
      if (first) return void (first = false);
      batch.current.base = ENTRANCE_DELAY_MS;
      batch.current.n = 0;
      run(true);
    });
  }, [navigation, run]);

  const onLayout = (e: LayoutChangeEvent) => {
    view.current = { ...view.current, h: e.nativeEvent.layout.height };
    run(false);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    view.current = { ...view.current, y: e.nativeEvent.contentOffset.y };
    run(false);
  };

  return { scope, scrollProps: { onLayout, onScroll, scrollEventThrottle: 16 } };
}

export function RevealProvider({ scope, children }: { scope: Scope; children: React.ReactNode }) {
  return <RevealContext.Provider value={scope}>{children}</RevealContext.Provider>;
}

/** One block that comes in as it scrolls into view. Must be a direct child of the scroll content. */
export function Reveal({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const scope = useContext(RevealContext);
  const reduced = useReducedMotion();
  const layout = useRef<{ y: number; h: number } | null>(null);
  const state = useRef<"pending" | "in">("pending");
  const opacity = useRef(new Animated.Value(0)).current;
  const shift = useRef(new Animated.Value(TRAVEL)).current;
  const scale = useRef(new Animated.Value(0.985)).current;
  const running = useRef<Animated.CompositeAnimation | null>(null);

  const hide = useCallback(
    (from: "above" | "below") => {
      running.current?.stop();
      state.current = "pending";
      opacity.setValue(0);
      shift.setValue(from === "above" ? -TRAVEL : TRAVEL);
      scale.setValue(0.985);
    },
    [opacity, shift, scale],
  );

  const show = useCallback(
    (delay: number) => {
      state.current = "in";
      running.current = Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, delay, easing: EASE_OUT, useNativeDriver: true }),
        Animated.timing(shift, { toValue: 0, duration: RISE_MS, delay, easing: EASE_OUT, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: RISE_MS, delay, easing: EASE_OUT, useNativeDriver: true }),
      ]);
      running.current.start();
    },
    [opacity, shift, scale],
  );

  const check = useCallback<Check>(
    (replay) => {
      if (!scope || !layout.current || layout.current.h <= 0) return;
      const { y, h: vh } = scope.view();
      if (vh <= 0) return;
      const top = layout.current.y - y;
      const bottom = top + layout.current.h;
      const seen = Math.min(bottom, vh) - Math.max(top, 0);
      const tall = layout.current.h > vh * 0.8;
      const enters = seen > 0 && (tall || seen / layout.current.h >= ENTER_RATIO);
      if (replay && enters) {
        hide("below");
        show(scope.nextDelay());
      } else if (state.current === "pending" && enters) {
        show(scope.nextDelay());
      } else if (state.current === "in" && seen <= 0) {
        // Fully off screen: reset quietly, ready to come back from the side it left by.
        hide(bottom <= 0 ? "above" : "below");
      }
    },
    [scope, hide, show],
  );

  useEffect(() => (scope ? scope.subscribe(check) : undefined), [scope, check]);

  if (reduced || !scope) return <>{children}</>;
  return (
    <Animated.View
      style={[style, { opacity, transform: [{ translateY: shift }, { scale }] }]}
      onLayout={(e) => {
        layout.current = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height };
        check(false);
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A little pop (the web's pp-pop: 0.6 → 1.15 → 1) when `on` turns true, for a
 * check being ticked. Not on first render, so a list of done items doesn't bounce.
 */
export function Pop({ on, children }: { on: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const was = useRef(on);
  useEffect(() => {
    if (on && !was.current && !reduced) {
      scale.setValue(0.6);
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 180, easing: EASE_OUT, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
    was.current = on;
  }, [on, reduced, scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}
