import React from "react";
import { Text as RNText, type TextProps } from "react-native";
import { fonts, usePalette } from "../theme";

type Weight = keyof typeof fonts.native;
type Tone = "primary" | "secondary" | "muted";

/** Manrope everywhere, with the palette's text tones. */
export default function Text({
  weight = "regular",
  tone = "primary",
  style,
  ...rest
}: TextProps & { weight?: Weight; tone?: Tone }) {
  const p = usePalette();
  const color = tone === "secondary" ? p.textSecondary : tone === "muted" ? p.textMuted : p.text;
  return <RNText {...rest} style={[{ fontFamily: fonts.native[weight], color }, style]} />;
}
