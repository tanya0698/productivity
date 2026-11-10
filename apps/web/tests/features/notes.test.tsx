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

function renderPage(db: MemoryDatabase, path = "/notes") {
  // A device that has its data already: empty means empty, not "still downloading".
  void db.setMeta("syncedOnce", "test");
  const runtime = new SyncRuntime({ db, transport: offline, deviceId: crypto.randomUUID(), newId: () => crypto.randomUUID() });
  vi.spyOn(runtime, "start").mockImplementation(() => {});
  function Harness() {
    const open = useCallback(async () => runtime, []);
    return (
      <SyncProvider open={open} failed={() => null}>
        <AntApp>
          <MemoryRouter initialEntries={[path]}>
            <HomePage />
          </MemoryRouter>
        </AntApp>
      </SyncProvider>
    );
  }
  return render(<Harness />);
}

describe("Notes page", () => {
  it("saves a new note locally once something is typed, with no connection", async () => {
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
    // One write, queued for the next sync: the note is created by the first save.
    expect((await db.pendingOperations(10)).length).toBe(1);
    expect(await screen.findAllByText("Groceries")).toBeTruthy();
  });

  it("never saves a new note that is left empty", async () => {
    const db = new MemoryDatabase();
    renderPage(db);
    fireEvent.click(await screen.findByRole("button", { name: /New note/ }));
    fireEvent.blur(await screen.findByLabelText("Note text"));
    fireEvent.click(screen.getByRole("button", { name: /New note/ }));
    await new Promise((r) => setTimeout(r, 50));
    expect(await db.list("note")).toHaveLength(0);
    expect(await db.pendingOperations(10)).toHaveLength(0);
  });

  it("starts a note inside a project from a project's link", async () => {
    const db = new MemoryDatabase();
    const projectId = crypto.randomUUID();
    renderPage(db, `/notes?new=1&project=${projectId}`);
    const text = await screen.findByLabelText("Note text");
    fireEvent.change(text, { target: { value: "Removal quotes" } });
    fireEvent.blur(text);
    await waitFor(async () => {
      const [note] = await db.list("note");
      expect(note).toMatchObject({ bodyText: "Removal quotes", projectId });
    });
  });

  it("deletes a saved note after confirming", async () => {
    const db = new MemoryDatabase();
    renderPage(db);
    fireEvent.click(await screen.findByRole("button", { name: /New note/ }));
    fireEvent.change(await screen.findByLabelText("Note text"), { target: { value: "temporary" } });
    fireEvent.blur(screen.getByLabelText("Note text"));
    await waitFor(async () => expect(await db.list("note")).toHaveLength(1));

    fireEvent.click(await screen.findByRole("button", { name: "Delete note" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(async () => expect(await db.list("note")).toHaveLength(0));
    expect(await screen.findByText(/No notes yet/)).toBeTruthy();
  });
});
