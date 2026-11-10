import { useCallback } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { MemoryDatabase, type LocalRecord } from "@productivity/database-local";
import { SyncRuntime, type SyncTransport } from "@productivity/sync-engine";
import { SyncProvider } from "@productivity/sync-engine/react";
import { newNote, newProject, newTask, setTaskStatus } from "@productivity/domain";
import ProjectsFeature from "@/features/projects";

const unused: SyncTransport = {
  push: async () => ({ results: [] }),
  pull: async (cursor) => ({ changes: [], cursor, hasMore: false }),
};

function Where() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderAt(db: MemoryDatabase, path: string) {
  // A device that has its data already: empty means empty, not "still downloading".
  void db.setMeta("syncedOnce", "test");
  const runtime = new SyncRuntime({ db, transport: unused, deviceId: crypto.randomUUID(), newId: () => crypto.randomUUID() });
  vi.spyOn(runtime, "start").mockImplementation(() => {});
  function Harness() {
    const open = useCallback(async () => runtime, []);
    return (
      <SyncProvider open={open} failed={() => null}>
        <AntApp>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/projects/*" element={<ProjectsFeature />} />
              <Route path="*" element={null} />
            </Routes>
            <Where />
          </MemoryRouter>
        </AntApp>
      </SyncProvider>
    );
  }
  return render(<Harness />);
}

const put = (db: MemoryDatabase, entity: "project" | "task" | "note", r: object) =>
  db.transaction((tx) => tx.put(entity, r as LocalRecord, "synced"));

describe("Projects", () => {
  it("creates a project and opens it", async () => {
    const db = new MemoryDatabase();
    renderAt(db, "/projects");
    expect(await screen.findByText(/No open projects/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /New project/ }));
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Kitchen renovation" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(async () => expect(await db.list("project")).toHaveLength(1));
    const [project] = await db.list("project");
    expect(project).toMatchObject({ title: "Kitchen renovation", status: "active" });
    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe(`/projects/${project!.id}`));
    expect(await screen.findByRole("heading", { name: "Kitchen renovation" })).toBeTruthy();
  }, 15000); // the drawer's open/close animations are slow under a parallel test run

  it("shows progress on the list", async () => {
    const db = new MemoryDatabase();
    const now = new Date();
    const p = newProject(crypto.randomUUID(), now, { title: "Move house" });
    await put(db, "project", p);
    await put(db, "task", setTaskStatus(newTask(crypto.randomUUID(), now, { title: "Book van", projectId: p.id }), "done", now));
    await put(db, "task", newTask(crypto.randomUUID(), now, { title: "Pack books", projectId: p.id }));
    await put(db, "task", newTask(crypto.randomUUID(), now, { title: "Unrelated" }));
    renderAt(db, "/projects");
    expect(await screen.findByText("Move house")).toBeTruthy();
    expect(screen.getByText("1 of 2 done")).toBeTruthy();
  });

  it("adds a task inside the project", async () => {
    const db = new MemoryDatabase();
    const p = newProject(crypto.randomUUID(), new Date(), { title: "Move house" });
    await put(db, "project", p);
    renderAt(db, `/projects/${p.id}`);

    const box = await screen.findByLabelText("New task");
    fireEvent.change(box, { target: { value: "Book van" } });
    fireEvent.keyDown(box, { key: "Enter", code: "Enter", keyCode: 13 });

    await waitFor(async () => expect(await db.list("task")).toHaveLength(1));
    expect((await db.list("task"))[0]).toMatchObject({ title: "Book van", projectId: p.id });
    expect(await screen.findByText("Book van")).toBeTruthy();
    expect(screen.getByText("0 of 1 done")).toBeTruthy();
  });

  it("deleting a project keeps its tasks and notes, without a project", async () => {
    const db = new MemoryDatabase();
    const now = new Date();
    const p = newProject(crypto.randomUUID(), now, { title: "Move house" });
    const task = newTask(crypto.randomUUID(), now, { title: "Book van", projectId: p.id });
    const note = newNote(crypto.randomUUID(), now, { title: "Removal quotes", projectId: p.id });
    await put(db, "project", p);
    await put(db, "task", task);
    await put(db, "note", note);
    renderAt(db, `/projects/${p.id}`);

    fireEvent.click(await screen.findByRole("button", { name: "Delete project" }));
    expect(await screen.findByText("Its 1 task and 1 note stay, without a project.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(async () => expect(await db.list("project")).toHaveLength(0));
    expect(await db.get("task", task.id)).toMatchObject({ projectId: null, deletedAt: null });
    expect(await db.get("note", note.id)).toMatchObject({ projectId: null, deletedAt: null });
    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/projects"));
  });
});
