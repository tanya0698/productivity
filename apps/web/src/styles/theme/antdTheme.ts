import { theme, type ThemeConfig } from "antd";
import { fonts, radii, type Palette } from "@productivity/theme";

/**
 * Ant Design themed with Ink & Teal (plan §4.4). Every antd component picks
 * these up through ConfigProvider, so screens use plain antd components and
 * never hard-code a colour.
 */
export function antdTheme(p: Palette, mode: "light" | "dark"): ThemeConfig {
  return {
    algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      fontFamily: fonts.family,
      fontFamilyCode: fonts.mono,
      colorPrimary: p.primary,
      colorInfo: p.primary,
      colorSuccess: p.success,
      colorWarning: p.warning,
      colorError: p.error,
      colorLink: p.primary,
      colorLinkHover: p.primaryStrong,
      colorTextHeading: p.heading,
      colorText: p.text,
      colorTextSecondary: p.textSecondary,
      colorTextTertiary: p.textMuted,
      colorTextQuaternary: p.textDisabled,
      colorTextLightSolid: p.onPrimary,
      colorBgLayout: p.page,
      colorBgContainer: p.surface,
      colorBgElevated: p.elevated,
      colorBorder: p.borderStrong,
      colorBorderSecondary: p.border,
      colorFillTertiary: p.muted,
      colorFillQuaternary: p.muted,
      // Disabled fields (like quick capture until Phase 2) keep the card surface, not a faded grey.
      colorBgContainerDisabled: p.surface,
      colorTextDisabled: p.textMuted,
      borderRadius: radii.sm,
      borderRadiusLG: radii.lg,
      borderRadiusSM: 8,
    },
    components: {
      Layout: { bodyBg: "transparent", siderBg: "transparent", headerBg: "transparent" },
      Menu: {
        itemBg: "transparent",
        itemSelectedBg: p.primarySoft,
        itemSelectedColor: p.primaryStrong,
        itemColor: p.textSecondary,
        itemHoverColor: p.heading,
        itemBorderRadius: radii.sm,
      },
      Card: { borderRadiusLG: radii.lg, colorBorderSecondary: p.border },
      Button: { primaryShadow: "none", primaryColor: p.onPrimary },
      Tag: { defaultBg: p.accentSoft, defaultColor: p.accentText },
      Segmented: { itemSelectedBg: p.elevated, trackBg: p.muted },
    },
  };
}

/** Values antd has no token for (glows, glass, mono labels), as CSS variables. */
export function cssVariables(p: Palette): Record<string, string> {
  return {
    "--pp-glow-primary": p.glow[0],
    "--pp-glow-accent": p.glow[1],
    "--pp-glass": p.glass.fill,
    "--pp-glass-strong": p.glass.fillStrong,
    "--pp-glass-border": p.glass.border,
    "--pp-page": p.page,
    "--pp-surface": p.surface,
    "--pp-muted": p.muted,
    "--pp-border": p.border,
    "--pp-heading": p.heading,
    "--pp-text": p.text,
    "--pp-text-secondary": p.textSecondary,
    "--pp-text-muted": p.textMuted,
    "--pp-primary": p.primary,
    "--pp-primary-soft": p.primarySoft,
    "--pp-accent": p.accent,
    "--pp-accent-soft": p.accentSoft,
    "--pp-accent-text": p.accentText,
    "--pp-error": p.error,
    "--pp-error-soft": p.errorSoft,
    "--pp-error-text": p.errorText,
    "--pp-warning-soft": p.warningSoft,
    "--pp-warning-text": p.warningText,
    "--pp-success": p.success,
    "--pp-success-soft": p.successSoft,
    "--pp-success-text": p.successText,
    "--pp-ai": p.ai,
    "--pp-ai-soft": p.aiSoft,
    "--pp-ai-text": p.aiText,
    "--pp-font-mono": fonts.mono,
    "--pp-label-tracking": fonts.labelTracking,
  };
}
