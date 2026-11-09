import { useSyncExternalStore } from "react";
import { useOptionalAuth } from "../auth/AuthProvider";

/**
 * The notification centre's list (plan §4: "notification centre in the
 * header"): what alerted recently, read or not. Kept on this device per
 * account; the server-side inbox (plan §8.1) can feed the same list later.
 */
export type NotificationKind = "reminder" | "focus" | "sync" | "info";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  /** Where clicking it goes. */
  href?: string;
  at: string;
  read: boolean;
}

const MAX = 60;

class NotificationStore {
  private readonly key: string;
  private value: AppNotification[];
  private readonly listeners = new Set<() => void>();

  constructor(userId: string) {
    this.key = `productivity:notifications:${userId}`;
    this.value = this.read();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key !== this.key) return;
        this.value = this.read();
        this.emit();
      });
    }
  }

  private read(): AppNotification[] {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as AppNotification[]) : [];
    } catch {
      return [];
    }
  }

  private save(next: AppNotification[]) {
    this.value = next.slice(0, MAX);
    try {
      localStorage.setItem(this.key, JSON.stringify(this.value));
    } catch {
      /* storage blocked: the list lasts for this visit */
    }
    this.emit();
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  get = () => this.value;
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };

  /** Add one, newest first. The same id twice (two tabs alerting) is kept once. */
  add(n: Omit<AppNotification, "at" | "read"> & { at?: string }) {
    if (this.value.some((x) => x.id === n.id)) return;
    this.save([{ ...n, at: n.at ?? new Date().toISOString(), read: false }, ...this.value]);
  }
  markRead(id: string) {
    this.save(this.value.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }
  markAllRead() {
    this.save(this.value.map((n) => ({ ...n, read: true })));
  }
  clear() {
    this.save([]);
  }
}

const stores = new Map<string, NotificationStore>();
export function notificationStore(userId: string): NotificationStore {
  let s = stores.get(userId);
  if (!s) stores.set(userId, (s = new NotificationStore(userId)));
  return s;
}

/** This account's notifications, and the store to add to or mark read. */
export function useNotifications() {
  const auth = useOptionalAuth();
  const store = notificationStore(auth?.session?.user.id ?? "local");
  const items = useSyncExternalStore(store.subscribe, store.get);
  return { items, unread: items.filter((n) => !n.read).length, store };
}
