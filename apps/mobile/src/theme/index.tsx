import React, { createContext, useContext } from "react";
import { useColorScheme } from "react-native";
import { light, dark, radii, fonts, type Palette } from "@productivity/theme";

/**
 * The same Ink & Teal tokens as the web app (packages/theme), following
 * the phone's light/dark setting.
 */
const PaletteContext = createContext<Palette>(light);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  return (
    <PaletteContext.Provider value={scheme === "dark" ? dark : light}>{children}</PaletteContext.Provider>
  );
}

export const usePalette = () => useContext(PaletteContext);

export { radii, fonts };
export type { Palette };
