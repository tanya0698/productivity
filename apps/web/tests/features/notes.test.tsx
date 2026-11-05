import { useCallback } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter } from "react-router-dom";
import { MemoryDatabase } from "@productivity/database-local";
import { SyncRuntime, type SyncTransport } from "@productivity/sync-engine";
import { SyncProvider } from "@productivity/sync-engine/react";
import HomePage from "@/features/notes/pages/HomePage";

const offline: SyncTransport = {
  push: async () => {
    throw new Error("not used: the runtime is never started");
  },
  pull: async () => {
    throw new Error("not used: the runtime is never started");
  },
};

function renderPage(db: MemoryDatabase) {
  const runtime = new SyncRuntime({ db, transport: offline, deviceId: crypto.randomUUID(), newId: () => crypto.randomUUID() });
  // Started by SyncProvider; a stopped transport just reports offline.
  vi.spyOn(runtime, "start").mockImplementation(() => {});
  function Harness() {
    const open = useCallback(async () => runtime, []);
    return (
      <SyncProvider open={open} failed={() => null}>
        <AntApp>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </AntApp>
      </SyncProvider>
    );
  }
  return render(<Harness />);
}

describe("Notes page", () => {
  it("shows the empty state, then saves a new note locally with no connection", async () => {
    const db = new MemoryDatabase();
    renderPage(db);
    expect(await screen.findByText(/No notes yet/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /New note/ }));
    const title = await screen.findByLabelText("Note title");
    fireEvent.change(title, { target: { value: "Groceries" } });
    fireEvent.change(screen.getByLabelText("Note text"), { target: { value: "milk and eggs" } });
    fireEvent.blur(screen.getByLabelText("Note text"));

    await waitFor(async () => {
      const [note] = await db.list("note");
      expect(note).toMatchObject({ title: "Groceries", bodyText: "milk and eggs" });
    });
    // The create and the edit are both queued for the next sync.
    expect((await db.pendingOperations(10)).length).toBe(2);
    expect(await screen.findAllByText("Groceries")).toBeTruthy();
  });

  it("deletes a note after confirming", async () => {
    const db = new MemoryDatabase();
    renderPage(db);
    fireEvent.click(await screen.findByRole("button", { name: /New note/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete note" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(async () => expect(await db.list("note")).toHaveLength(0));
    expect(await screen.findByText(/No notes yet/)).toBeTruthy();
  });
});
