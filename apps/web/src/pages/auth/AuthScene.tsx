import type { ReactNode } from "react";
import { CheckOutlined, CloudSyncOutlined, FireOutlined, LockOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { APP_NAME, APP_TAGLINE, brandImages } from "@/shared/brand";

export type AuthSceneVariant = "sign-in" | "sign-up" | "reset" | "secure";

interface Statement {
  kicker: string;
  /** Each entry is a line; the last one gets the brand gradient. */
  lines: string[];
  sub: string;
}

const STATEMENTS: Record<AuthSceneVariant, Statement> = {
  "sign-in": {
    kicker: "Welcome back",
    lines: ["Pick up right", "where you", "left off."],
    sub: "Everything you saved offline is already here, and syncs the moment you're connected.",
  },
  "sign-up": {
    kicker: "Start today",
    lines: ["Small steps,", "every day,", "add up."],
    sub: "Plan the day, keep the habits, and watch your goals move. On every device, even offline.",
  },
  reset: {
    kicker: "New password",
    lines: ["A fresh start.", "Same", "progress."],
    sub: "Your tasks, notes and streaks stay exactly as they were.",
  },
  secure: {
    kicker: "Two-step verification",
    lines: ["Your day is", "yours. Only", "you get in."],
    sub: "A code from your phone keeps a stolen password from being enough.",
  },
};

/** One floating card from the app itself. */
function Chip({ className, children }: { className: string; children: ReactNode }) {
  return <div className={`pp-scene-chip ${className}`}>{children}</div>;
}

/** The focus timer's ring, about three-quarters through. */
function FocusRing() {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden>
      <circle cx="19" cy="19" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" className="pp-scene-ring-track" />
      <circle
        cx="19"
        cy="19"
        r={r}
        fill="none"
        stroke="url(#pp-scene-ring)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${c * 0.72} ${c}`}
        transform="rotate(-90 19 19)"
        className="pp-scene-ring-arc"
      />
    </svg>
  );
}

/**
 * The brand side of the auth screens: an original scene (lit spheres, orbit
 * rings with travelling lights) around a glass card that carries one
 * statement per screen, with small pieces of the app drifting around it.
 * Dark and light versions follow the colour mode (global.css).
 * Purely decorative: the whole panel is aria-hidden by AuthCard.
 */
export function AuthScene({ variant }: { variant: AuthSceneVariant }) {
  const s = STATEMENTS[variant];
  return (
    <>
      <svg className="pp-scene-backdrop" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <radialGradient id="pp-orb-teal" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#99f6e4" />
            <stop offset="35%" stopColor="#2dd4bf" />
            <stop offset="75%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#063c39" />
          </radialGradient>
          <radialGradient id="pp-orb-indigo" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#c7d2fe" />
            <stop offset="35%" stopColor="#818cf8" />
            <stop offset="80%" stopColor="#3730a3" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </radialGradient>
          <radialGradient id="pp-orb-amber" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="40%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#b45309" />
          </radialGradient>
          <radialGradient id="pp-orb-ink" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#334155" className="pp-orb-ink-a" />
            <stop offset="100%" stopColor="#0b0f14" className="pp-orb-ink-b" />
          </radialGradient>
          <linearGradient id="pp-scene-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <filter id="pp-scene-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>

        {/* Soft light behind everything. */}
        <circle cx="470" cy="160" r="170" fill="#2dd4bf" opacity="0.16" filter="url(#pp-scene-soft)" />
        <circle cx="60" cy="640" r="190" fill="#818cf8" opacity="0.16" filter="url(#pp-scene-soft)" />

        {/* Orbits around the statement, each with a light travelling on it. */}
        <g className="pp-scene-orbits">
          <g className="pp-scene-orbit pp-scene-orbit-a">
            <ellipse cx="300" cy="460" rx="270" ry="270" fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="1" className="pp-scene-track" />
            <circle cx="570" cy="460" r="5" fill="#2dd4bf" className="pp-scene-spark" />
          </g>
          <g className="pp-scene-orbit pp-scene-orbit-b">
            <ellipse cx="300" cy="460" rx="350" ry="350" fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="1" strokeDasharray="2 10" className="pp-scene-track pp-scene-track-faint" />
            <circle cx="-50" cy="460" r="4" fill="#a5b4fc" className="pp-scene-spark" />
          </g>
          <g className="pp-scene-orbit pp-scene-orbit-c">
            <ellipse cx="300" cy="460" rx="200" ry="200" fill="none" stroke="rgba(45,212,191,0.12)" strokeWidth="1" className="pp-scene-track pp-scene-track-teal" />
            <circle cx="300" cy="260" r="3.5" fill="#fbbf24" className="pp-scene-spark" />
          </g>
        </g>

        {/* The spheres: big teal and indigo bodies, an ink one for depth, and an amber spark. */}
        <g className="pp-scene-orb pp-scene-orb-1">
          <circle cx="505" cy="120" r="120" fill="url(#pp-orb-teal)" />
        </g>
        <g className="pp-scene-orb pp-scene-orb-2">
          <circle cx="20" cy="640" r="130" fill="url(#pp-orb-indigo)" />
        </g>
        <g className="pp-scene-orb pp-scene-orb-3">
          <circle cx="90" cy="150" r="54" fill="url(#pp-orb-ink)" />
          <circle cx="90" cy="150" r="54" fill="none" stroke="rgba(255,255,255,0.06)" className="pp-orb-ink-rim" />
        </g>
        <g className="pp-scene-orb pp-scene-orb-4">
          <circle cx="395" cy="250" r="26" fill="url(#pp-orb-amber)" />
        </g>
        <g className="pp-scene-orb pp-scene-orb-5">
          <circle cx="555" cy="770" r="40" fill="url(#pp-orb-teal)" opacity="0.9" />
        </g>
      </svg>

      <div className="pp-scene-top">
        <img src={brandImages.mark} alt="" width={34} height={34} />
        <span>{APP_NAME}</span>
      </div>

      <div className="pp-scene-stage">
        <div className="pp-scene-card">
          <span className="pp-scene-kicker">{s.kicker}</span>
          <span className="pp-scene-rule" />
          <h2 className="pp-scene-statement">
            {s.lines.map((line, i) => (
              <span key={line} className={i === s.lines.length - 1 ? "pp-scene-accent" : undefined}>
                {line}
              </span>
            ))}
          </h2>
          <p className="pp-scene-sub">{s.sub}</p>
        </div>

        <Chip className="pp-scene-chip-task">
          <span className="pp-scene-check">
            <CheckOutlined />
          </span>
          <span>
            <s>Morning run</s>
            <small>Done · 7:10 AM</small>
          </span>
        </Chip>

        <Chip className="pp-scene-chip-streak">
          <span className="pp-scene-icon pp-scene-icon-amber">
            <FireOutlined />
          </span>
          <span>
            <b>12-day streak</b>
            <small>Read 20 pages</small>
          </span>
        </Chip>

        <Chip className="pp-scene-chip-focus">
          <FocusRing />
          <span>
            <b>18:04</b>
            <small>Focus session</small>
          </span>
        </Chip>

        <Chip className="pp-scene-chip-event">
          <span className="pp-scene-bar" />
          <span>
            <b>10:00 Stand-up</b>
            <small>Today · 30 min</small>
          </span>
        </Chip>

        <Chip className="pp-scene-chip-sync">
          {variant === "secure" ? <SafetyCertificateOutlined /> : variant === "reset" ? <LockOutlined /> : <CloudSyncOutlined />}
          <small>{variant === "secure" ? "Second factor on" : variant === "reset" ? "Nothing lost" : "Synced · works offline"}</small>
        </Chip>
      </div>

      <div className="pp-scene-foot">
        <strong>{APP_NAME}</strong>
        <span>{APP_TAGLINE}</span>
      </div>
    </>
  );
}
