import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Appearance, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { light as baseLight, dark as baseDark, radii, fonts, type Palette as BasePalette } from "@productivity/theme";

/**
 * The phone's glass, after park-check: content sits on translucent panels over
 * a coloured gradient (with two soft glows), so the colour shows through as
 * you scroll. Only the phone changes: the web keeps the shared tokens.
 *
 *  - surface: cards, tiles and rows become glass (translucent, no blur:
 *    expo-blur only blurs on Android 12+ and turns grey elsewhere).
 *  - cardBorder: the bright edge that makes a translucent panel read as glass.
 *  - elevated stays solid, for sheets and anything typed into.
 */
export type Palette = BasePalette & { cardBorder: string; glows: [string, string] };

const light: Palette = {
  ...baseLight,
  gradient: ["#c4efe6", "#dbe3fb", "#eef1fa"],
  glows: ["rgba(20, 184, 166, 0.30)", "rgba(99, 102, 241, 0.24)"],
  surface: "rgba(255, 255, 255, 0.52)",
  cardBorder: "rgba(255, 255, 255, 0.85)",
  glass: { fill: "rgba(255, 255, 255, 0.40)", fillStrong: "rgba(255, 255, 255, 0.62)", border: "rgba(255, 255, 255, 0.85)" },
};

const dark: Palette = {
  ...baseDark,
  gradient: ["#0d3634", "#131c38", "#0b0f14"],
  glows: ["rgba(45, 212, 191, 0.22)", "rgba(129, 140, 248, 0.20)"],
  surface: "rgba(20, 30, 44, 0.50)",
  cardBorder: "rgba(255, 255, 255, 0.12)",
  glass: { fill: "rgba(18, 27, 40, 0.45)", fillStrong: "rgba(14, 21, 31, 0.68)", border: "rgba(255, 255, 255, 0.14)" },
};

/**
 * The same Ink & Teal tokens as the web app (packages/theme). Follows the
 * phone's light/dark setting unless the person picks one under More →
 * Appearance; the choice is remembered on this phone.
 *
 * Appearance.setColorScheme applies the choice app-wide, so useColorScheme,
 * native dialogs and the keyboard all agree with it.
 */
export type ColorMode = "system" | "light" | "dark";
const MODE_KEY = "creedence.color-mode";

const PaletteContext = createContext<Palette>(light);
const ModeContext = createContext<{ mode: ColorMode; setMode: (m: ColorMode) => void }>({
  mode: "system",
  setMode: () => undefined,
});

const apply = (m: ColorMode) => Appearance.setColorScheme(m === "system" ? "unspecified" : m);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ColorMode | null>(null);
  const scheme = useColorScheme();

  useEffect(() => {
    let live = true;
    SecureStore.getItemAsync(MODE_KEY)
      .catch(() => null)
      .then((saved) => {
        if (!live) return;
        const m: ColorMode = saved === "light" || saved === "dark" ? saved : "system";
        apply(m);
        setModeState(m);
      });
    return () => {
      live = false;
    };
  }, []);

  const setMode = useCallback((m: ColorMode) => {
    apply(m);
    setModeState(m);
    void SecureStore.setItemAsync(MODE_KEY, m).catch(() => undefined);
  }, []);

  // A moment at start-up while the saved choice is read, so there's no flash of the wrong mode.
  if (mode === null) return null;
  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      <PaletteContext.Provider value={scheme === "dark" ? dark : light}>{children}</PaletteContext.Provider>
    </ModeContext.Provider>
  );
}

export const usePalette = () => useContext(PaletteContext);
export const useColorMode = () => useContext(ModeContext);

export { radii, fonts };
