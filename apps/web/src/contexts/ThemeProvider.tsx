import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { App as AntApp, ConfigProvider } from "antd";
import { palettes, type Palette } from "@productivity/theme";
import { antdTheme, cssVariables } from "@/styles/theme/antdTheme";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export type ColorModeSetting = "system" | "light" | "dark";

interface ThemeContextValue {
  mode: "light" | "dark";
  setting: ColorModeSetting;
  setSetting: (s: ColorModeSetting) => void;
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
 * Light/dark following the system by default, with a manual override that
 * is remembered on this device. Wraps antd's ConfigProvider and <App> (the
 * latter so `App.useApp()` messages and modals pick up the theme).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [setting, setSettingState] = useState<ColorModeSetting>(readSetting);
  const mode = setting === "system" ? (prefersDark ? "dark" : "light") : setting;
  const palette = palettes[mode];

  const setSetting = (s: ColorModeSetting) => {
    setSettingState(s);
    try {
      localStorage.setItem(STORAGE_KEY, s);
    } catch {
      /* private mode: setting just isn't remembered */
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(cssVariables(palette))) root.style.setProperty(k, v);
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
  }, [palette, mode]);

  const value = useMemo(() => ({ mode, setting, setSetting, palette }), [mode, setting, palette]);

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
