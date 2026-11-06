import type { ReactNode } from "react";

/**
 * A mono label over a big figure, like the portfolio card's "FROM $300".
 * `tone` colours the figure: teal by default, or a state colour when the
 * number itself is a warning (overdue).
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "primary" | "error" | "neutral";
}) {
  const color = { primary: "var(--pp-primary)", error: "var(--pp-error)", neutral: "var(--pp-heading)" }[tone];
  return (
    <div className="pp-tile">
      <span className="pp-label">{label}</span>
      <span className="pp-tile-value pp-num" style={{ color }}>
        {value}
      </span>
      {hint ? <span className="pp-tile-hint">{hint}</span> : null}
    </div>
  );
}
