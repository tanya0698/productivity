/**
 * "Lavender Glass" — the single source of colour, glass, radius and font tokens
 * for every client (plan §4.4). The web app maps these onto Ant Design's theme
 * in `apps/web/src/styles/theme/antdTheme.ts`; the Android app reads them
 * directly in `apps/mobile/src/theme/`.
 *
 * Rules that the values below are built around:
 *  - Glass and the gradient are for the app's frame only (sidebar, headers,
 *    capture field, tab bar, modals). Content sits on solid `surface`/`page`.
 *  - Text on glass or gradient is `textSecondary` or darker; `textMuted` is for
 *    solid surfaces only.
 *  - State colours (success/warning/error/ai) mean something and are never
 *    decorative. Badges pair a `*Soft` background with the `*Text` colour.
 */

export interface Palette {
  gradient: readonly [string, string, string];
  glass: { fill: string; fillStrong: string; border: string };

  page: string;
  surface: string;
  elevated: string;
  muted: string;

  border: string;
  borderStrong: string;
  focus: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;

  primary: string;
  primarySoft: string;
  primaryStrong: string;
  onPrimary: string;

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

export const light: Palette = {
  gradient: ["#BFD4FF", "#D9DEFF", "#ECE8FB"],
  glass: {
    fill: "rgba(255,255,255,0.55)",
    fillStrong: "rgba(255,255,255,0.72)",
    border: "rgba(255,255,255,0.75)",
  },

  page: "#F3F1FA",
  surface: "#FFFFFF",
  elevated: "#FFFFFF",
  muted: "#EEEDF7",

  border: "#E4E2F0",
  borderStrong: "#CFCCE0",
  focus: "#3563F5",

  text: "#15151A",
  textSecondary: "#55556A",
  textMuted: "#74748A",
  textDisabled: "#B9B8CC",

  // park-check's #3D6BFF deepened one step: white text on it is ~4.9:1 (AA).
  primary: "#3563F5",
  primarySoft: "#E3EBFF",
  primaryStrong: "#2B52D6",
  onPrimary: "#FFFFFF",

  success: "#2E9E6B",
  successSoft: "#E4F5EC",
  successText: "#20734D",
  // Amber fails as text on light surfaces; use warningText on warningSoft.
  warning: "#F5A524",
  warningSoft: "#FDF1DA",
  warningText: "#8A5A00",
  error: "#E5484D",
  errorSoft: "#FDE7E8",
  errorText: "#BF2E36",
  // Stronger than the lavender neutrals so AI suggestions stay distinct.
  ai: "#8B4FD9",
  aiSoft: "#F2EAFD",
  aiText: "#6B33B8",

  overlay: "rgba(21, 21, 40, 0.72)",
  backdrop: "rgba(21, 21, 40, 0.45)",
};

export const dark: Palette = {
  gradient: ["#1C2452", "#231F48", "#16172B"],
  glass: {
    fill: "rgba(34,38,78,0.55)",
    fillStrong: "rgba(34,38,78,0.78)",
    border: "rgba(255,255,255,0.12)",
  },

  page: "#121320",
  surface: "#1A1B2B",
  elevated: "#222437",
  muted: "#1E1F31",

  border: "#2B2D44",
  borderStrong: "#3A3C57",
  focus: "#7D9BFF",

  text: "#E8E7F2",
  textSecondary: "#A6A6BD",
  textMuted: "#7E7E97",
  textDisabled: "#4A4B63",

  primary: "#7D9BFF",
  primarySoft: "#1F2A52",
  primaryStrong: "#A3B8FF",
  onPrimary: "#0E1330",

  success: "#4CC38A",
  successSoft: "#16302A",
  successText: "#4CC38A",
  warning: "#F2B04A",
  warningSoft: "#3A2E17",
  warningText: "#F2B04A",
  error: "#F2686C",
  errorSoft: "#3D1D24",
  errorText: "#F2686C",
  ai: "#B794F6",
  aiSoft: "#2B2145",
  aiText: "#C4A8F8",

  overlay: "rgba(0, 0, 0, 0.75)",
  backdrop: "rgba(0, 0, 0, 0.6)",
};

export const palettes = { light, dark } as const;
export type ColorMode = keyof typeof palettes;

/** Rounded like park-check. */
export const radii = { sm: 10, md: 14, lg: 18, pill: 999 } as const;

/** Manrope on every platform (plan §4.4). Weight 800 is for large headings only. */
export const fonts = {
  family: '"Manrope", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  /** Font names registered by @expo-google-fonts/manrope on Android. */
  native: {
    regular: "Manrope_400Regular",
    medium: "Manrope_500Medium",
    semiBold: "Manrope_600SemiBold",
    bold: "Manrope_700Bold",
    extraBold: "Manrope_800ExtraBold",
  },
} as const;
