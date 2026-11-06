import React from "react";
import { Text as RNText, type TextProps } from "react-native";
import { fonts, usePalette } from "../theme";

type Weight = Exclude<keyof typeof fonts.native, "mono" | "monoBold">;
type Tone = "heading" | "primary" | "secondary" | "muted" | "brand";

/**
 * Inter everywhere, with the palette's text tones. `label` gives the small
 * uppercase JetBrains Mono style from the portfolio ("ELTON CHIPUKA", "FROM").
 */
export default function Text({
  weight = "regular",
  tone = "primary",
  label = false,
  style,
  children,
  ...rest
}: TextProps & { weight?: Weight; tone?: Tone; label?: boolean }) {
  const p = usePalette();
  const color = {
    heading: p.heading,
    primary: p.text,
    secondary: p.textSecondary,
    muted: p.textMuted,
    brand: p.primary,
  }[tone];
  const labelStyle = label
    ? {
        fontFamily: tone === "brand" ? fonts.native.monoBold : fonts.native.mono,
        fontSize: 11,
        // React Native takes letter spacing in points; ~0.18em at 11pt.
        letterSpacing: 2,
        textTransform: "uppercase" as const,
      }
    : { fontFamily: fonts.native[weight] };
  return (
    <RNText {...rest} style={[{ color }, labelStyle, style]}>
      {children}
    </RNText>
  );
}
