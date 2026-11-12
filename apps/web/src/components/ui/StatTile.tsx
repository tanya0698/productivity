import type { ReactNode } from "react";
import { EntityCard, type CardTrend, type Tone } from "./EntityCard";

/**
 * A stat card: the EntityCard layout for a single figure (Done today, Focus
 * time, …). `label` is the card's title; `hint` the caption under the value.
 * `tone` "error" colours the value when the number itself is a warning
 * (overdue); the icon carries the card's colour (`iconTone`).
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "primary",
  size = "default",
  icon,
  iconTone = "primary",
  subtitle,
  trend,
  ring,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "primary" | "error" | "neutral";
  /** "small" for a narrow column or a long value like a date. */
  size?: "default" | "small";
  icon?: ReactNode;
  iconTone?: Tone;
  subtitle?: ReactNode;
  trend?: CardTrend;
  ring?: { percent: number | null; label: string };
}) {
  return (
    <EntityCard
      icon={icon}
      tone={iconTone}
      title={label}
      subtitle={subtitle}
      value={value}
      valueTone={tone === "error" ? "error" : "default"}
      compact={size === "small"}
      trend={trend}
      caption={hint}
      ring={ring}
    />
  );
}
