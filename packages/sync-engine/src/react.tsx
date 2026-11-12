/**
 * The React side of local data, shared by the web and Android apps. Screens
 * read and write through these hooks; they never touch the API for synced
 * records (plan §11.3).
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { EntityType } from "@productivity/contracts";
import type { ConflictEntry, LocalRecord, OutboxEntry } from "@productivity/database-local";
import type { SyncStatus } from "./engine.ts";
import type { SyncRuntime } from "./runtime.ts";

const RuntimeContext = createContext<SyncRuntime | null>(null);

/** Opens local storage once, starts syncing, and stops when unmounted. */
export function SyncProvider({
  open,
  loading = null,
  failed,
  children,
}: {
  open: () => Promise<SyncRuntime>;
  loading?: ReactNode;
  failed: (error: unknown) => ReactNode;
  children: ReactNode;
}) {
  const [state, setState] = useState<{ runtime?: SyncRuntime; error?: unknown }>({});

  useEffect(() => {
    let cancelled = false;
    let started: SyncRuntime | undefined;
    open().then(
      (runtime) => {
        if (cancelled) return;
        started = runtime;
        runtime.start();
        setState({ runtime });
      },
      (error: unknown) => {
        if (!cancelled) setState({ error });
      },
    );
    return () => {
      cancelled = true;
      started?.stop();
    };
    // `open` is expected to be a stable, memoised function.
  }, [open]);

  if (state.error !== undefined) return <>{failed(state.error)}</>;
  if (!state.runtime) return <>{loading}</>;
  return <RuntimeContext.Provider value={state.runtime}>{children}</RuntimeContext.Provider>;
}

export function useSyncRuntime(): SyncRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("useSyncRuntime must be used inside <SyncProvider>.");
  return runtime;
}

export function useSyncStatus(): SyncStatus {
  const runtime = useSyncRuntime();
  return useSyncExternalStore(runtime.subscribe, runtime.getStatus);
}

/** This device's recent syncs (the last day), newest last: for the Sync page's comparisons. */
export function useSyncHistory() {
  const runtime = useSyncRuntime();
  return useSyncExternalStore(runtime.subscribe, runtime.getHistory);
}

/**
 * Whether screens can trust that "empty" means empty: this device has synced
 * at least once, or it can't sync right now (offline, signed out, an error),
 * in which case what's on the device is all there is to show.
 */
export function useInitialSyncDone(): boolean {
  const runtime = useSyncRuntime();
  const status = useSyncStatus();
  const synced = useSyncExternalStore(runtime.subscribe, runtime.hasSyncedOnce);
  return synced || status.state === "offline" || status.state === "needs_attention";
}

export interface SyncDetails {
  conflicts: ConflictEntry[];
  /** Changes saved on this device that the server hasn't accepted yet. */
  queued: OutboxEntry[];
  loading: boolean;
}

/** Open conflicts and the outbox, re-read whenever the sync status changes. */
export function useSyncDetails(): SyncDetails {
  const runtime = useSyncRuntime();
  const [state, setState] = useState<SyncDetails>({ conflicts: [], queued: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void Promise.all([runtime.db.conflicts(), runtime.db.pendingOperations(Number.MAX_SAFE_INTEGER)]).then(
        ([conflicts, queued]) => {
          if (!cancelled) setState({ conflicts, queued, loading: false });
        },
      );
    };
    load();
    const stop = runtime.subscribe(load);
    return () => {
      cancelled = true;
      stop();
    };
  }, [runtime]);

  return state;
}

/** Live records of one type from the local database, re-read whenever they change. */
export function useLocalRecords<T extends LocalRecord = LocalRecord>(entity: EntityType): { records: T[]; loading: boolean } {
  const { db } = useSyncRuntime();
  const [state, setState] = useState<{ records: T[]; loading: boolean }>({ records: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void db.list(entity).then((records) => {
        if (!cancelled) setState({ records: records as T[], loading: false });
      });
    };
    load();
    const stop = db.subscribe(entity, load);
    return () => {
      cancelled = true;
      stop();
    };
  }, [db, entity]);

  return state;
}
