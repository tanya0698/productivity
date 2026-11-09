import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { App as AntApp, ConfigProvider } from "antd";
import { palettes, type Palette } from "@productivity/theme";
import { antdTheme, cssVariables } from "@/styles/theme/antdTheme";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export type ColorModeSetting = "system" | "light" | "dark";

interface ThemeContextValue {
  mode: "light" | "dark";
  setting: ColorModeSetting;
  setSetting: (s: ColorModeSetting) => void;
  /** Switch to the other mode (and remember it), from whatever is showing now. */
  toggle: () => void;
  palette: Palette;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "productivity:color-mode";

function readSetting(): ColorModeSetting {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/**
 * Light/dark following the system until the user picks one with the header
 * toggle; that choice is remembered on this device. Wraps antd's ConfigProvider and <App> (the
 * latter so `App.useApp()` messages and modals pick up the theme).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [setting, setSettingState] = useState<ColorModeSetting>(readSetting);
  // Paper is white: printing (Reports → PDF) always uses the light theme.
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  const mode = printing ? "light" : setting === "system" ? (prefersDark ? "dark" : "light") : setting;
  const palette = palettes[mode];

  const setSetting = (s: ColorModeSetting) => {
    // A short cross-fade of colours while the palette swaps (none with reduced motion).
    const root = document.documentElement;
    root.classList.add("pp-theme-switching");
    window.setTimeout(() => root.classList.remove("pp-theme-switching"), 400);
    setSettingState(s);
    try {
      localStorage.setItem(STORAGE_KEY, s);
    } catch {
      /* private mode: setting just isn't remembered */
    }
  };

  // Layout effect, so the CSS variables are in place before a print snapshot.
  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(cssVariables(palette))) root.style.setProperty(k, v);
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
  }, [palette, mode]);

  const value = useMemo(
    () => ({ mode, setting, setSetting, toggle: () => setSetting(mode === "dark" ? "light" : "dark"), palette }),
    // setSetting only touches state and storage.
    [mode, setting, palette],
  );

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={antdTheme(palette, mode)}>
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return ctx;
}
