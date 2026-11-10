import { useCallback } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter } from "react-router-dom";
import { MemoryDatabase, type LocalRecord } from "@productivity/database-local";
import { newNote, editNote } from "@productivity/domain";
import { SyncRuntime, TransientSyncError, type SyncTransport } from "@productivity/sync-engine";
import { SyncProvider } from "@productivity/sync-engine/react";
import SyncPage from "@/pages/sync/SyncPage";

// Resolving a conflict syncs straight away; here the network is simply down.
const offline: SyncTransport = {
  push: async () => {
    throw new TransientSyncError("offline");
  },
  pull: async () => {
    throw new TransientSyncError("offline");
  },
};

async function seedConflict(db: MemoryDatabase) {
  const now = new Date();
  const base = { ...newNote(crypto.randomUUID(), now, { title: "Groceries", text: "milk" }), version: 1 };
  const local = editNote(base, { text: "milk and eggs" }, now) as unknown as LocalRecord;
  const server = { ...editNote(base, { text: "milk and bread" }, now), version: 2 } as unknown as LocalRecord;
  await db.transaction(async (tx) => {
    await tx.put("note", local, "conflict");
    await tx.recordConflict({ entityType: "note", entityId: base.id, local, server, detectedAt: now.toISOString() });
  });
  return base.id;
}

function renderPage(db: MemoryDatabase) {
  // A device that has its data already: empty means empty, not "still downloading".
  void db.setMeta("syncedOnce", "test");
  const runtime = new SyncRuntime({ db, transport: offline, deviceId: crypto.randomUUID(), newId: () => crypto.randomUUID() });
  vi.spyOn(runtime, "start").mockImplementation(() => {});
  function Harness() {
    const open = useCallback(async () => runtime, []);
    return (
      <SyncProvider open={open} failed={() => null}>
        <AntApp>
          <MemoryRouter>
            <SyncPage />
          </MemoryRouter>
        </AntApp>
      </SyncProvider>
    );
  }
  return render(<Harness />);
}

describe("Sync page", () => {
  it("says so when there's nothing to settle", async () => {
    renderPage(new MemoryDatabase());
    expect(await screen.findByText(/No conflicts/)).toBeTruthy();
  });

  it("shows both versions side by side", async () => {
    const db = new MemoryDatabase();
    await seedConflict(db);
    renderPage(db);
    expect(await screen.findByText("milk and eggs")).toBeTruthy();
    expect(screen.getByText("milk and bread")).toBeTruthy();
    expect(screen.getByText("On this device")).toBeTruthy();
    expect(screen.getByText("On the server")).toBeTruthy();
  });

  it("keeps the server's version and drops this device's", async () => {
    const db = new MemoryDatabase();
    const id = await seedConflict(db);
    renderPage(db);
    fireEvent.click(await screen.findByRole("button", { name: "Keep the server's" }));
    await waitFor(async () => expect(await db.conflicts()).toHaveLength(0));
    expect(await db.get("note", id)).toMatchObject({ bodyText: "milk and bread", version: 2 });
    expect(await db.pendingOperations(10)).toHaveLength(0);
    expect(await screen.findByText(/No conflicts/)).toBeTruthy();
  });

  it("keeps this device's version, queued on top of the server's", async () => {
    const db = new MemoryDatabase();
    const id = await seedConflict(db);
    renderPage(db);
    fireEvent.click(await screen.findByRole("button", { name: "Keep this device's" }));
    await waitFor(async () => expect(await db.conflicts()).toHaveLength(0));
    expect(await db.get("note", id)).toMatchObject({ bodyText: "milk and eggs", version: 2 });
    const [queued] = await db.pendingOperations(10);
    expect(queued?.operation).toMatchObject({ entityId: id, baseVersion: 2, op: "upsert" });
    // The stat tile, plus the list card that only appears once something is queued.
    await waitFor(() => expect(screen.getAllByText("Waiting to send")).toHaveLength(2));
  });

  it("keeps both as separate notes", async () => {
    const db = new MemoryDatabase();
    await seedConflict(db);
    renderPage(db);
    fireEvent.click(await screen.findByRole("button", { name: "Keep both" }));
    await waitFor(async () => expect(await db.list("note")).toHaveLength(2));
    const titles = (await db.list("note")).map((n) => n.title).sort();
    expect(titles).toEqual(["Groceries", "Groceries (copy from this device)"]);
  });
});
