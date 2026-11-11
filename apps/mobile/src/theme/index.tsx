import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Appearance, useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { light, dark, radii, fonts, type Palette } from "@productivity/theme";

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
export type { Palette };
