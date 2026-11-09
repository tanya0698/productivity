import { useEffect, useRef, useState, type ReactNode } from "react";

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts up to `target` (ease-out, ~0.6 s), from where it was; instant with reduced motion. */
function useCountUp(target: number, duration = 650): number {
  const [shown, setShown] = useState(target);
  const from = useRef(0);
  const still = reducedMotion();
  useEffect(() => {
    if (still) {
      from.current = target;
      return;
    }
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - (1 - k) ** 3;
      setShown(Math.round(begin + (target - begin) * eased));
      if (k < 1) frame = requestAnimationFrame(step);
      else from.current = target;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, still]);
  return still ? target : shown;
}

function Counted({ value }: { value: number }) {
  return <>{useCountUp(value).toLocaleString()}</>;
}

/**
 * A mono label over a big figure, like the portfolio card's "FROM $300".
 * `tone` colours the figure: teal by default, or a state colour when the
 * number itself is a warning (overdue). Plain numbers count up when they
 * appear or change. Proportional figures here (big standalone numbers);
 * tabular figures are for columns.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "primary",
  size = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "primary" | "error" | "neutral";
  /** "small" for tiles in a narrow column. */
  size?: "default" | "small";
}) {
  const color = { primary: "var(--pp-primary)", error: "var(--pp-error)", neutral: "var(--pp-heading)" }[tone];
  return (
    <div className="pp-tile">
      <span className="pp-label">{label}</span>
      <span className={`pp-tile-value${size === "small" ? " pp-tile-value-small" : ""}`} style={{ color }}>
        {typeof value === "number" ? <Counted value={value} /> : value}
      </span>
      {hint ? <span className="pp-tile-hint">{hint}</span> : null}
    </div>
  );
}
