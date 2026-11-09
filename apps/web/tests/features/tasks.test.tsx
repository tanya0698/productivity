import { useCallback } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter } from "react-router-dom";
import { MemoryDatabase } from "@productivity/database-local";
import { SyncRuntime, type SyncTransport } from "@productivity/sync-engine";
import { SyncProvider } from "@productivity/sync-engine/react";
import { addDays, localDate, newTask } from "@productivity/domain";
import HomePage from "@/features/tasks/pages/HomePage";

const unused: SyncTransport = {
  push: async () => ({ results: [] }),
  pull: async (cursor) => ({ changes: [], cursor, hasMore: false }),
};

function renderTasks(db: MemoryDatabase) {
  const runtime = new SyncRuntime({ db, transport: unused, deviceId: crypto.randomUUID(), newId: () => crypto.randomUUID() });
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
  return { ...render(<Harness />), runtime };
}

const today = localDate(new Date());

describe("Tasks page", () => {
  it("adds a task with Enter, saved locally with no connection", async () => {
    const db = new MemoryDatabase();
    renderTasks(db);
    expect(await screen.findByText(/No tasks yet/)).toBeTruthy();

    const box = screen.getByLabelText("New task");
    fireEvent.change(box, { target: { value: "Buy printer ink" } });
    fireEvent.keyDown(box, { key: "Enter", code: "Enter", keyCode: 13 });

    await waitFor(async () => {
      const [task] = await db.list("task");
      expect(task).toMatchObject({ title: "Buy printer ink", status: "todo", priority: 3, dueDate: null });
    });
    expect(await screen.findByText("Buy printer ink")).toBeTruthy();
    expect(screen.getByText("No date")).toBeTruthy();
    expect((await db.pendingOperations(10)).length).toBe(1);
  });

  it("groups by due date and shows priority in words", async () => {
    const db = new MemoryDatabase();
    const { runtime } = renderTasks(db);
    await screen.findByLabelText("New task");
    await runtime.write("task", newTask(crypto.randomUUID(), new Date(), { title: "Late", dueDate: addDays(today, -1) }));
    await runtime.write("task", newTask(crypto.randomUUID(), new Date(), { title: "Now", dueDate: today, priority: 1 }));
    await runtime.write("task", newTask(crypto.randomUUID(), new Date(), { title: "Soon", dueDate: addDays(today, 2) }));

    expect(await screen.findByText("Overdue")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Upcoming")).toBeTruthy();
    expect(screen.getByText("Urgent")).toBeTruthy();
    expect(screen.getByText(/Due today/)).toBeTruthy();
  });

  it("ticks a task off and back on", async () => {
    const db = new MemoryDatabase();
    const { runtime } = renderTasks(db);
    await screen.findByLabelText("New task");
    await runtime.write("task", newTask(crypto.randomUUID(), new Date(), { title: "Water plants" }));

    fireEvent.click(await screen.findByLabelText('Mark "Water plants" as done'));
    await waitFor(async () => expect((await db.list("task"))[0]).toMatchObject({ status: "done" }));
    expect(await screen.findByText(/Done · 1/)).toBeTruthy();

    fireEvent.click(screen.getByText(/Done · 1/));
    fireEvent.click(await screen.findByLabelText('Mark "Water plants" as not done'));
    await waitFor(async () => expect((await db.list("task"))[0]).toMatchObject({ status: "todo", completedAt: null }));
  });

  it("edits and deletes a task from its panel", async () => {
    const db = new MemoryDatabase();
    const { runtime } = renderTasks(db);
    await screen.findByLabelText("New task");
    await runtime.write("task", newTask(crypto.randomUUID(), new Date(), { title: "Draft budget" }));

    fireEvent.click(await screen.findByRole("button", { name: "Open task: Draft budget" }));
    const panel = await screen.findByRole("dialog");
    fireEvent.change(within(panel).getByLabelText("Title"), { target: { value: "Draft Q4 budget" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Save" }));
    await waitFor(async () => expect((await db.list("task"))[0]).toMatchObject({ title: "Draft Q4 budget" }));

    fireEvent.click(await screen.findByRole("button", { name: "Open task: Draft Q4 budget" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete task" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(async () => expect(await db.list("task")).toHaveLength(0));
  });
});
