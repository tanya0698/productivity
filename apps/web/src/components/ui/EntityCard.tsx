import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * The stat card used wherever a card shows numbers (the hub template's entity
 * card layout, in Creedence's own tokens):
 *
 *   [icon]  Title                     ( ring )
 *           subtitle                  ring label
 *   VALUE  ▲ 20%
 *   caption
 *
 * One tone per card, from the theme, on the icon and its tile only. The trend
 * pill is green when the change is good and red when it's bad, with ▲/▼ so it
 * isn't colour alone. Every card has a ring (one hue, the brand teal); with
 * nothing to measure it shows 0. Every word on the card is capitalised, as
 * in the template ("Recurring Revenue"). All but the title and value are optional.
 */

export type Tone = "primary" | "accent" | "success" | "warning" | "error" | "ai" | "neutral";

export interface CardTrend {
  /** Percentage change vs the period before; null shows nothing (no earlier data). */
  change: number | null;
  /** Whether going up is good (tasks done) or bad (overdue). Default true. */
  goodWhenUp?: boolean;
  /** "%" by default; " pts" for a change in a rate. */
  unit?: string;
  /** For screen readers and the tooltip: "vs last week". */
  period?: string;
}

export interface EntityCardProps {
  icon?: ReactNode;
  tone?: Tone;
  title: ReactNode;
  subtitle?: ReactNode;
  value: ReactNode;
  /** Colour of the value: the default heading ink, or a state when the number itself is a warning. */
  valueTone?: "default" | "primary" | "error";
  /** Smaller value, for a narrow column or a long value like a date. */
  compact?: boolean;
  trend?: CardTrend;
  caption?: ReactNode;
  ring?: { percent: number | null; label: string };
  /** Makes the whole card a link-like control. */
  onOpen?: () => void;
  ariaLabel?: string;
}

const toneVar = (t: Tone) => (t === "neutral" ? "var(--pp-text-secondary)" : `var(--pp-${t === "primary" ? "primary" : t})`);

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts up to `target` (ease-out, ~0.6 s) from where it was; instant with reduced motion. */
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
      setShown(Math.round(begin + (target - begin) * (1 - (1 - k) ** 3)));
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

export function TrendPill({ trend }: { trend: CardTrend }) {
  const { change, goodWhenUp = true, unit = "%", period = "vs last week" } = trend;
  if (change === null) return null;
  if (change === 0) {
    return (
      <span className="pp-trend pp-trend-flat" title={`No change ${period}`} aria-label={`No change ${period}`}>
        ● 0{unit}
      </span>
    );
  }
  const up = change > 0;
  const good = up === goodWhenUp;
  const text = `${up ? "Up" : "Down"} ${Math.abs(change)}${unit.trim() === "pts" ? " points" : " percent"} ${period}`;
  return (
    <span className={`pp-trend ${good ? "pp-trend-good" : "pp-trend-bad"}`} title={text} aria-label={text}>
      {up ? "▲" : "▼"}
      {Math.abs(change)}
      {unit}
    </span>
  );
}

/** A thin progress ring with its number inside, both in the brand teal (as the template's). */
export function ProgressRing({ percent, size = 44, label }: { percent: number; size?: number; label: string }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <span className="pp-ring" role="img" aria-label={`${label}: ${p}%`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pp-border)" strokeWidth={stroke} />
        <circle
          className="pp-ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--pp-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(p / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="pp-ring-value pp-num">{p}</span>
    </span>
  );
}

export function EntityCard({
  icon,
  tone = "primary",
  title,
  subtitle,
  value,
  valueTone = "default",
  compact = false,
  trend,
  caption,
  ring,
  onOpen,
  ariaLabel,
}: EntityCardProps) {
  const color = toneVar(tone);
  const valueColor = { default: "var(--pp-heading)", primary: "var(--pp-primary)", error: "var(--pp-error)" }[valueTone];
  const link = onOpen
    ? {
        role: "link" as const,
        tabIndex: 0,
        onClick: onOpen,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        },
        "aria-label": ariaLabel,
      }
    : {};

  return (
    <div className={`pp-entity pp-reveal${onOpen ? " pp-entity-link" : ""}`} {...link}>
      <div className="pp-entity-head">
        {icon ? (
          <span className="pp-entity-icon" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }} aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className="pp-entity-titles">
          <span className="pp-entity-title">{title}</span>
          {subtitle ? <span className="pp-entity-subtitle">{subtitle}</span> : null}
        </span>
      </div>
      <div className="pp-entity-body">
        <div className="pp-entity-metric">
          <div className="pp-entity-value-row">
            <span className={`pp-entity-value${compact ? " pp-entity-value-compact" : ""}`} style={{ color: valueColor }}>
              {typeof value === "number" ? <Counted value={value} /> : value}
            </span>
            {trend ? <TrendPill trend={trend} /> : null}
          </div>
          {caption ? <span className="pp-entity-caption">{caption}</span> : null}
        </div>
        {ring ? (
          <span className="pp-entity-ring">
            <ProgressRing percent={ring.percent ?? 0} label={ring.label} />
            <span className="pp-entity-caption">{ring.label}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
