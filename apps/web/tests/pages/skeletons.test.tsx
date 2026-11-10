import { useCallback } from "react";
import { act, render, screen } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter } from "react-router-dom";
import { MemoryDatabase } from "@productivity/database-local";
import { SyncRuntime, type SyncTransport } from "@productivity/sync-engine";
import { SyncProvider } from "@productivity/sync-engine/react";
import HomePage from "@/features/tasks/pages/HomePage";

const empty: SyncTransport = {
  push: async () => ({ results: [] }),
  pull: async (cursor) => ({ changes: [], cursor, hasMore: false }),
};

describe("Skeleton loaders", () => {
  it("shows placeholders on a new device until the first sync, then the real empty state", async () => {
    const db = new MemoryDatabase();
    const runtime = new SyncRuntime({ db, transport: empty, deviceId: crypto.randomUUID(), newId: () => crypto.randomUUID() });
    vi.spyOn(runtime, "start").mockImplementation(() => {});
    function Harness() {
      const open = useCallback(async () => runtime, []);
      return (
        <SyncProvider open={open} failed={() => null}>
          <AntApp>
            <MemoryRouter initialEntries={["/tasks"]}>
              <HomePage />
            </MemoryRouter>
          </AntApp>
        </SyncProvider>
      );
    }
    render(<Harness />);

    expect((await screen.findAllByText(/^Loading/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/No tasks yet/)).toBeNull();

    await act(async () => {
      await runtime.syncNow();
    });
    expect(await screen.findByText(/No tasks yet/)).toBeTruthy();
    expect(screen.queryAllByText(/^Loading/)).toHaveLength(0);
    expect(await db.getMeta("syncedOnce")).toBeTruthy();
  });
});
