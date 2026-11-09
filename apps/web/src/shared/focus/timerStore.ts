import { useSyncExternalStore } from "react";
import type { TimerState } from "@productivity/domain";
import { useOptionalAuth } from "../auth/AuthProvider";

/**
 * The running focus timer, kept on this device (plan Phase 5: only finished
 * sessions sync). Stored per account in localStorage, so it survives a reload
 * and other tabs see the same timer; `sessionId` is fixed at start, so tabs
 * that both notice the end save the same record, not two.
 */
export interface Timer extends TimerState {
  sessionId: string;
}

/** What just finished, so the page can offer the next step (a break, or back to work). */
export interface Finished {
  kind: TimerState["kind"];
  minutes: number;
  at: string;
}

interface Stored {
  timer: Timer | null;
  finished: Finished | null;
}

const EMPTY: Stored = { timer: null, finished: null };

class TimerStore {
  private readonly key: string;
  private value: Stored;
  private readonly listeners = new Set<() => void>();

  constructor(userId: string) {
    this.key = `productivity:focus-timer:${userId}`;
    this.value = this.read();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key !== this.key) return;
        this.value = this.read();
        this.listeners.forEach((l) => l());
      });
    }
  }

  private read(): Stored {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? { ...EMPTY, ...(JSON.parse(raw) as Stored) } : EMPTY;
    } catch {
      return EMPTY;
    }
  }

  get = (): Stored => this.value;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  set(next: Partial<Stored>) {
    this.value = { ...this.value, ...next };
    try {
      localStorage.setItem(this.key, JSON.stringify(this.value));
    } catch {
      /* storage blocked: the timer still runs in this tab */
    }
    this.listeners.forEach((l) => l());
  }
}

const stores = new Map<string, TimerStore>();
export function timerStore(userId: string): TimerStore {
  let s = stores.get(userId);
  if (!s) stores.set(userId, (s = new TimerStore(userId)));
  return s;
}

/** This account's timer store, and its current value. */
export function useFocusTimer() {
  const auth = useOptionalAuth();
  const store = timerStore(auth?.session?.user.id ?? "local");
  const value = useSyncExternalStore(store.subscribe, store.get);
  return { ...value, store };
}
