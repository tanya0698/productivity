import { useEffect, useState } from "react";
import { elapsedMs, pauseTimer, resumeTimer, sessionFrom, startTimer, type FocusKind } from "@productivity/domain";
import { useSyncRuntime } from "@productivity/sync-engine/react";
import { useFocusTimer, type Timer } from "./timerStore";

/** Sessions shorter than this, stopped early, aren't worth keeping. */
const MIN_SAVED_MS = 60_000;

/** The timer plus what you can do with it. Saving a session is a normal synced write. */
export function useFocus() {
  const runtime = useSyncRuntime();
  const { timer, finished, store } = useFocusTimer();

  const start = (kind: FocusKind, minutes: number, link: { taskId?: string | null; projectId?: string | null } = {}) =>
    store.set({ timer: { ...startTimer(kind, minutes, link, new Date()), sessionId: runtime.newId() }, finished: null });

  const pause = () => timer && store.set({ timer: { ...pauseTimer(timer, new Date()), sessionId: timer.sessionId } });
  const resume = () => timer && store.set({ timer: { ...resumeTimer(timer, new Date()), sessionId: timer.sessionId } });

  /** Ran out: save it as completed and say what finished. */
  const complete = (t: Timer) => {
    const now = new Date();
    void runtime.write("focus_session", sessionFrom(t.sessionId, t, now, true));
    store.set({ timer: null, finished: { kind: t.kind, minutes: t.plannedMinutes, at: now.toISOString() } });
  };

  /** Stopped early: keep it (as not completed) if it ran at least a minute. */
  const stop = () => {
    if (!timer) return;
    const now = new Date();
    if (timer.kind === "focus" && elapsedMs(timer, now) >= MIN_SAVED_MS) {
      void runtime.write("focus_session", sessionFrom(timer.sessionId, timer, now, false));
    }
    store.set({ timer: null, finished: null });
  };

  const dismissFinished = () => store.set({ finished: null });

  return { timer, finished, start, pause, resume, stop, complete, dismissFinished };
}

/** The current time, every second while `active`. */
export function useTicking(active: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return active ? now : new Date();
}
