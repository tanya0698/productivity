import { useCallback } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter, useLocation } from "react-router-dom";
import { MemoryDatabase, type LocalRecord } from "@productivity/database-local";
import { SyncRuntime, type SyncTransport } from "@productivity/sync-engine";
import { SyncProvider } from "@productivity/sync-engine/react";
import { newNote, newProject, newTask } from "@productivity/domain";
import { SearchPalette } from "@/shared/search/SearchPalette";

const unused: SyncTransport = {
  push: async () => ({ results: [] }),
  pull: async (cursor) => ({ changes: [], cursor, hasMore: false }),
};

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="path">{pathname + search}</output>;
}

async function setup() {
  const db = new MemoryDatabase();
  const now = new Date();
  const project = newProject(crypto.randomUUID(), now, { title: "Kitchen renovation" });
  const task = newTask(crypto.randomUUID(), now, { title: "Send October invoice", projectId: project.id });
  const note = newNote(crypto.randomUUID(), now, { title: "Plumber", text: "Call about the kitchen sink on Monday" });
  await db.transaction(async (tx) => {
    await tx.put("project", project as unknown as LocalRecord, "synced");
    await tx.put("task", task as unknown as LocalRecord, "synced");
    await tx.put("note", note as unknown as LocalRecord, "synced");
  });
  // A device that has its data already: empty means empty, not "still downloading".
  void db.setMeta("syncedOnce", "test");
  const runtime = new SyncRuntime({ db, transport: unused, deviceId: crypto.randomUUID(), newId: () => crypto.randomUUID() });
  vi.spyOn(runtime, "start").mockImplementation(() => {});
  const onClose = vi.fn();
  function Harness() {
    const open = useCallback(async () => runtime, []);
    return (
      <SyncProvider open={open} failed={() => null}>
        <AntApp>
          <MemoryRouter>
            <SearchPalette open onClose={onClose} />
            <Where />
          </MemoryRouter>
        </AntApp>
      </SyncProvider>
    );
  }
  render(<Harness />);
  return { task, note, project, onClose };
}

describe("Search", () => {
  it("finds tasks, notes and projects on this device, highlighting the match", async () => {
    await setup();
    const box = await screen.findByLabelText("Search everything");
    await screen.findByText(/Searches the 3 items/);
    fireEvent.change(box, { target: { value: "kitchen" } });
    const options = await screen.findAllByRole("option");
    // The project's title matches; the note only in its body, so it ranks lower.
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Kitchen renovation"),
      expect.stringContaining("Plumber"),
    ]);
    expect(options[0]!.querySelector("mark")?.textContent).toBe("Kitchen");
  });

  it("says when nothing matches", async () => {
    await setup();
    fireEvent.change(await screen.findByLabelText("Search everything"), { target: { value: "zebra" } });
    expect(await screen.findByText(/Nothing matches/)).toBeTruthy();
  });

  it("opens the chosen result with the keyboard", async () => {
    const { note, onClose } = await setup();
    const box = await screen.findByLabelText("Search everything");
    await screen.findByText(/Searches the 3 items/);
    fireEvent.change(box, { target: { value: "kitchen" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe(`/notes?note=${note.id}`));
    expect(onClose).toHaveBeenCalled();
  });

  it("opens a task in the Tasks page", async () => {
    const { task } = await setup();
    const box = await screen.findByLabelText("Search everything");
    await screen.findByText(/Searches the 3 items/);
    fireEvent.change(box, { target: { value: "invoice" } });
    fireEvent.click(await screen.findByRole("option"));
    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe(`/tasks?task=${task.id}`));
  });
});
