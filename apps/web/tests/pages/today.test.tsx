import { useCallback } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter } from "react-router-dom";
import { MemoryDatabase } from "@productivity/database-local";
import { SyncRuntime, type SyncTransport } from "@productivity/sync-engine";
import { SyncProvider } from "@productivity/sync-engine/react";
import { addDays, localDate, newTask } from "@productivity/domain";
import TodayPage from "@/pages/home/TodayPage";

const unused: SyncTransport = {
  push: async () => ({ results: [] }),
  pull: async (cursor) => ({ changes: [], cursor, hasMore: false }),
};

function renderToday(db: MemoryDatabase) {
  const runtime = new SyncRuntime({ db, transport: unused, deviceId: crypto.randomUUID(), newId: () => crypto.randomUUID() });
  vi.spyOn(runtime, "start").mockImplementation(() => {});
  function Harness() {
    const open = useCallback(async () => runtime, []);
    return (
      <SyncProvider open={open} failed={() => null}>
        <AntApp>
          <MemoryRouter>
            <TodayPage />
          </MemoryRouter>
        </AntApp>
      </SyncProvider>
    );
  }
  return { ...render(<Harness />), runtime };
}

const enter = (el: HTMLElement) => fireEvent.keyDown(el, { key: "Enter", code: "Enter", keyCode: 13 });

describe("Today", () => {
  beforeEach(() => localStorage.clear());

  it("quick capture adds a task by default, and clears the box", async () => {
    const db = new MemoryDatabase();
    renderToday(db);
    const box = (await screen.findByLabelText("Quick capture")) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "Call the bank about the card" } });
    enter(box);

    await waitFor(async () => {
      const [task] = await db.list("task");
      expect(task).toMatchObject({ title: "Call the bank about the card", status: "todo" });
    });
    await waitFor(() => expect(box.value).toBe(""));
    expect(await screen.findByText("Added to Tasks")).toBeTruthy();
    expect(await db.list("note")).toHaveLength(0);
  });

  it("switches to notes, and remembers the choice", async () => {
    const db = new MemoryDatabase();
    renderToday(db);
    fireEvent.click(await screen.findByText("Note"));
    const box = await screen.findByLabelText("Quick capture");
    fireEvent.change(box, { target: { value: "Ideas for the weekend" } });
    enter(box);

    await waitFor(async () => {
      const [note] = await db.list("note");
      expect(note).toMatchObject({ bodyText: "Ideas for the weekend" });
    });
    expect(await screen.findByText("Saved to Notes")).toBeTruthy();
    expect(localStorage.getItem("productivity:capture-kind")).toBe("note");
  });

  it("ignores Enter on an empty box", async () => {
    const db = new MemoryDatabase();
    renderToday(db);
    const box = await screen.findByLabelText("Quick capture");
    fireEvent.change(box, { target: { value: "   " } });
    enter(box);
    await new Promise((r) => setTimeout(r, 50));
    expect(await db.list("task")).toHaveLength(0);
    expect(await db.list("note")).toHaveLength(0);
  });

  it("counts tasks due today and overdue, and lists them under Up next", async () => {
    const db = new MemoryDatabase();
    const today = localDate(new Date());
    const { runtime } = renderToday(db);
    await screen.findByLabelText("Quick capture");
    await runtime.write("task", newTask(crypto.randomUUID(), new Date(), { title: "Pay rent", dueDate: today }));
    await runtime.write("task", newTask(crypto.randomUUID(), new Date(), { title: "Renew licence", dueDate: addDays(today, -2) }));
    await runtime.write("task", newTask(crypto.randomUUID(), new Date(), { title: "Someday idea" }));

    expect(await screen.findByText("Pay rent")).toBeTruthy();
    expect(screen.getByText("Renew licence")).toBeTruthy();
    expect(screen.queryByText("Someday idea")).toBeNull(); // no date: not "up next"
    expect(screen.getByText(/Overdue ·/)).toBeTruthy();
  });
});
