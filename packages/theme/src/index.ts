/**
 * "Ink & Teal" — the single source of colour, glow, radius and font tokens for
 * every client (plan §4.4). Taken from the owner's portfolio: near-black ink with
 * soft teal and indigo glows, teal as the accent, indigo as the second accent,
 * slate text, Inter for UI and JetBrains Mono for small uppercase labels.
 *
 * The web app maps these onto Ant Design's theme in
 * `apps/web/src/styles/theme/antdTheme.ts`; the Android app reads them directly
 * in `apps/mobile/src/theme/`.
 *
 * Rules the values are built around:
 *  - Colour carries meaning. Teal is the brand and primary action; indigo marks
 *    tags and secondary accents; green, amber and red mean done, due soon and
 *    overdue; violet means AI. Nothing decorative borrows a state colour.
 *  - Badges pair a `*Soft` background with the `*Text` colour.
 *  - The light theme uses darker teal and indigo: the dark theme's #2dd4bf is
 *    only about 1.8:1 on white, far below the 4.5:1 text needs.
 */

export interface Palette {
  /** Corner glows behind the app: [teal, indigo]. Also the mobile header gradient's tint. */
  glow: readonly [string, string];
  /** Three-stop header gradient for Android, from teal-tinted to plain page. */
  gradient: readonly [string, string, string];
  /** Translucent panels for the app's frame (sidebar, tab bar). */
  glass: { fill: string; fillStrong: string; border: string };

  page: string;
  surface: string;
  elevated: string;
  muted: string;

  border: string;
  borderStrong: string;
  focus: string;

  heading: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;

  primary: string;
  primarySoft: string;
  primaryStrong: string;
  onPrimary: string;

  /** Indigo: tags, chips, secondary emphasis. */
  accent: string;
  accentSoft: string;
  accentText: string;

  success: string;
  successSoft: string;
  successText: string;
  warning: string;
  warningSoft: string;
  warningText: string;
  error: string;
  errorSoft: string;
  errorText: string;
  ai: string;
  aiSoft: string;
  aiText: string;

  overlay: string;
  backdrop: string;
}

export const dark: Palette = {
  glow: ["rgba(45, 212, 191, 0.14)", "rgba(129, 140, 248, 0.12)"],
  gradient: ["#0f2a2b", "#111a2a", "#0b0f14"],
  glass: {
    fill: "rgba(15, 22, 32, 0.6)",
    fillStrong: "rgba(15, 22, 32, 0.85)",
    border: "rgba(255, 255, 255, 0.10)",
  },

  page: "#0b0f14",
  surface: "#0f1620",
  elevated: "#141d29",
  muted: "#131b26",

  border: "#1c2532",
  borderStrong: "#2a3442",
  focus: "#5eead4",

  heading: "#f8fafc",
  text: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  textDisabled: "#475569",

  primary: "#2dd4bf",
  primarySoft: "#0f2e2c",
  primaryStrong: "#5eead4",
  onPrimary: "#04201d",

  accent: "#818cf8",
  accentSoft: "#1a1e3d",
  accentText: "#a5b4fc",

  success: "#4ade80",
  successSoft: "#0f2a1a",
  successText: "#86efac",
  warning: "#fbbf24",
  warningSoft: "#2b2211",
  warningText: "#fcd34d",
  error: "#f87171",
  errorSoft: "#2e1517",
  errorText: "#fca5a5",
  ai: "#c084fc",
  aiSoft: "#24183a",
  aiText: "#d8b4fe",

  overlay: "rgba(0, 0, 0, 0.75)",
  backdrop: "rgba(0, 0, 0, 0.6)",
};

export const light: Palette = {
  glow: ["rgba(20, 184, 166, 0.12)", "rgba(99, 102, 241, 0.10)"],
  gradient: ["#d9f7f2", "#e8ecfb", "#f8fafc"],
  glass: {
    fill: "rgba(255, 255, 255, 0.7)",
    fillStrong: "rgba(255, 255, 255, 0.88)",
    border: "rgba(15, 23, 42, 0.08)",
  },

  page: "#f8fafc",
  surface: "#ffffff",
  elevated: "#ffffff",
  muted: "#f1f5f9",

  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  focus: "#0f766e",

  heading: "#0b0f14",
  text: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#64748b",
  textDisabled: "#94a3b8",

  primary: "#0f766e",
  primarySoft: "#ccfbf1",
  primaryStrong: "#115e59",
  onPrimary: "#ffffff",

  accent: "#4f46e5",
  accentSoft: "#e0e7ff",
  accentText: "#4338ca",

  success: "#16a34a",
  successSoft: "#dcfce7",
  successText: "#166534",
  warning: "#d97706",
  warningSoft: "#fef3c7",
  warningText: "#92400e",
  error: "#dc2626",
  errorSoft: "#fee2e2",
  errorText: "#b91c1c",
  ai: "#9333ea",
  aiSoft: "#f3e8ff",
  aiText: "#7e22ce",

  overlay: "rgba(11, 15, 20, 0.6)",
  backdrop: "rgba(11, 15, 20, 0.4)",
};

export const palettes = { light, dark } as const;
export type ColorMode = keyof typeof palettes;

export const radii = { sm: 10, md: 14, lg: 16, pill: 999 } as const;

/** Inter for everything; JetBrains Mono for small uppercase labels and figures that line up. */
export const fonts = {
  family: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "Cascadia Mono", Consolas, monospace',
  /** Font names registered by @expo-google-fonts on Android. */
  native: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semiBold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
    extraBold: "Inter_800ExtraBold",
    mono: "JetBrainsMono_500Medium",
    monoBold: "JetBrainsMono_700Bold",
  },
  /** Mono labels: uppercase, letter-spaced, like "ELTON CHIPUKA" and "FROM". */
  labelTracking: "0.18em",
} as const;
