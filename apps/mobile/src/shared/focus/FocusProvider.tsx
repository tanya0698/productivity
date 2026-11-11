import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import {
  elapsedMs,
  isFinished,
  pauseTimer,
  remainingMs,
  resumeTimer,
  sessionFrom,
  startTimer,
  type FocusKind,
  type TimerState,
} from "@productivity/domain";
import { useSyncRuntime } from "@productivity/sync-engine/react";
import { CHANNEL, FOCUS_NOTIFICATION, askForNotifications, setUpNotifications } from "../reminders/notifications";

/**
 * The running focus timer, kept on this phone (only finished sessions sync).
 * Saved in the account's local database, so it survives the app being
 * closed; an alert is scheduled for its end, so it rings with the app shut.
 */
export interface Timer extends TimerState {
  sessionId: string;
}

/** What just finished, so the screen can offer the next step (a break, or back to work). */
export interface Finished {
  kind: FocusKind;
  minutes: number;
  at: string;
}

interface Stored {
  timer: Timer | null;
  finished: Finished | null;
}

const KEY = "focus.timer";
/** Sessions shorter than this, stopped early, aren't worth keeping. */
const MIN_SAVED_MS = 60_000;

interface FocusApi extends Stored {
  start: (kind: FocusKind, minutes: number, link?: { taskId?: string | null; projectId?: string | null }) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  dismissFinished: () => void;
}

const FocusContext = createContext<FocusApi | null>(null);

export function useFocus(): FocusApi {
  const api = useContext(FocusContext);
  if (!api) throw new Error("useFocus outside FocusProvider");
  return api;
}

/** The current time, every second while `active`. */
export function useTicking(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return active ? now : new Date();
}

async function scheduleEnd(t: Timer | null) {
  await Notifications.cancelScheduledNotificationAsync(FOCUS_NOTIFICATION).catch(() => undefined);
  if (!t?.runningSince) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await setUpNotifications();
  const at = new Date(Date.now() + remainingMs(t, new Date()));
  await Notifications.scheduleNotificationAsync({
    identifier: FOCUS_NOTIFICATION,
    content: {
      title: t.kind === "focus" ? `${t.plannedMinutes} minutes of focus done` : "Break over",
      body: t.kind === "focus" ? "Time for a short break." : "Ready for another session?",
      data: { focus: true },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
  });
}

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const runtime = useSyncRuntime();
  const [state, setState] = useState<Stored>({ timer: null, finished: null });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    void runtime.db.getMeta(KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Partial<Stored>;
        setState({ timer: saved.timer ?? null, finished: saved.finished ?? null });
      } catch {
        /* a corrupt value: start clean */
      }
    });
  }, [runtime]);

  const set = useCallback(
    (next: Stored) => {
      setState(next);
      void runtime.db.setMeta(KEY, JSON.stringify(next));
      void scheduleEnd(next.timer).catch(() => undefined);
    },
    [runtime],
  );

  /** Ran out: save it as completed and say what finished. */
  const complete = useCallback(
    (t: Timer) => {
      const now = new Date();
      void runtime.write("focus_session", sessionFrom(t.sessionId, t, now, true));
      set({ timer: null, finished: { kind: t.kind, minutes: t.plannedMinutes, at: now.toISOString() } });
    },
    [runtime, set],
  );

  // Notice the end: every second while running, and on coming back to the app.
  const running = !!state.timer?.runningSince;
  useEffect(() => {
    if (!running) return;
    const check = () => {
      const t = stateRef.current.timer;
      if (t && isFinished(t, new Date())) complete(t);
    };
    check();
    const id = setInterval(check, 1000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && check());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [running, complete]);

  const api: FocusApi = {
    ...state,
    start: (kind, minutes, link = {}) => {
      void askForNotifications().then((ok) => ok && void scheduleEnd(stateRef.current.timer));
      set({ timer: { ...startTimer(kind, minutes, link, new Date()), sessionId: runtime.newId() }, finished: null });
    },
    pause: () => {
      const t = stateRef.current.timer;
      if (t) set({ ...stateRef.current, timer: { ...pauseTimer(t, new Date()), sessionId: t.sessionId } });
    },
    resume: () => {
      const t = stateRef.current.timer;
      if (t) set({ ...stateRef.current, timer: { ...resumeTimer(t, new Date()), sessionId: t.sessionId } });
    },
    stop: () => {
      const t = stateRef.current.timer;
      if (!t) return;
      const now = new Date();
      if (t.kind === "focus" && elapsedMs(t, now) >= MIN_SAVED_MS) void runtime.write("focus_session", sessionFrom(t.sessionId, t, now, false));
      set({ timer: null, finished: null });
    },
    dismissFinished: () => set({ ...stateRef.current, finished: null }),
  };

  return <FocusContext.Provider value={api}>{children}</FocusContext.Provider>;
}
