import { theme, type ThemeConfig } from "antd";
import { fonts, radii, type Palette } from "@productivity/theme";

/**
 * Ant Design themed with Lavender Glass (plan §4.4). Every antd component
 * picks these up through ConfigProvider, so screens use plain antd components
 * and never hard-code a colour.
 */
export function antdTheme(p: Palette, mode: "light" | "dark"): ThemeConfig {
  return {
    algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      fontFamily: fonts.family,
      colorPrimary: p.primary,
      colorInfo: p.primary,
      colorSuccess: p.success,
      colorWarning: p.warning,
      colorError: p.error,
      colorLink: p.primary,
      colorText: p.text,
      colorTextSecondary: p.textSecondary,
      colorTextTertiary: p.textMuted,
      colorBgLayout: p.page,
      colorBgContainer: p.surface,
      colorBgElevated: p.elevated,
      colorBorder: p.borderStrong,
      colorBorderSecondary: p.border,
      colorFillTertiary: p.muted,
      borderRadius: radii.sm,
      borderRadiusLG: radii.lg,
      borderRadiusSM: 8,
    },
    components: {
      Layout: { bodyBg: p.page, siderBg: "transparent", headerBg: "transparent" },
      Menu: {
        itemBg: "transparent",
        itemSelectedBg: p.surface,
        itemSelectedColor: p.primaryStrong,
        itemColor: p.textSecondary,
        itemBorderRadius: radii.sm,
      },
      Card: { borderRadiusLG: radii.lg },
      Button: { primaryShadow: "none" },
    },
  };
}

/** Values antd has no token for (glass, gradient), as CSS variables. */
export function cssVariables(p: Palette): Record<string, string> {
  return {
    "--pp-gradient": `linear-gradient(155deg, ${p.gradient[0]} 0%, ${p.gradient[1]} 45%, ${p.gradient[2]} 100%)`,
    "--pp-glass": p.glass.fill,
    "--pp-glass-strong": p.glass.fillStrong,
    "--pp-glass-border": p.glass.border,
    "--pp-page": p.page,
    "--pp-surface": p.surface,
    "--pp-border": p.border,
    "--pp-text": p.text,
    "--pp-text-secondary": p.textSecondary,
    "--pp-ai": p.ai,
    "--pp-ai-soft": p.aiSoft,
    "--pp-ai-text": p.aiText,
  };
}
