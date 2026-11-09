import { useCallback } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter } from "react-router-dom";
import { MemoryDatabase, type LocalRecord } from "@productivity/database-local";
import { SyncRuntime, type SyncTransport } from "@productivity/sync-engine";
import { SyncProvider } from "@productivity/sync-engine/react";
import { newTask, sessionFrom, setTaskStatus, startTimer } from "@productivity/domain";
import ReportsPage from "@/features/reports/pages/ReportsPage";

const unused: SyncTransport = {
  push: async () => ({ results: [] }),
  pull: async (cursor) => ({ changes: [], cursor, hasMore: false }),
};

async function renderReports(db: MemoryDatabase) {
  const runtime = new SyncRuntime({ db, transport: unused, deviceId: crypto.randomUUID(), newId: () => crypto.randomUUID() });
  vi.spyOn(runtime, "start").mockImplementation(() => {});
  function Harness() {
    const open = useCallback(async () => runtime, []);
    return (
      <SyncProvider open={open} failed={() => null}>
        <AntApp>
          <MemoryRouter>
            <ReportsPage />
          </MemoryRouter>
        </AntApp>
      </SyncProvider>
    );
  }
  return render(<Harness />);
}

const daysAgo = (n: number, h = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 0, 0, 0);
  return d;
};

async function seed(db: MemoryDatabase) {
  const put = (e: "task" | "focus_session", r: object) => db.transaction((tx) => tx.put(e, r as LocalRecord, "synced"));
  for (const n of [1, 2, 2]) await put("task", setTaskStatus(newTask(crypto.randomUUID(), daysAgo(5), { title: `Done ${n}` }), "done", daysAgo(n)));
  await put("task", newTask(crypto.randomUUID(), daysAgo(3), { title: "Still open" }));
  const t = startTimer("focus", 25, {}, daysAgo(1));
  await put("focus_session", sessionFrom(crypto.randomUUID(), t, new Date(daysAgo(1).getTime() + 25 * 60_000), true));
}

describe("Reports", () => {
  it("shows the period's numbers", async () => {
    const db = new MemoryDatabase();
    await seed(db);
    await renderReports(db);
    const tasksTile = (await screen.findByText("Tasks completed")).closest(".pp-tile") as HTMLElement;
    await waitFor(() => expect(within(tasksTile).getByText("3")).toBeTruthy());
    const focusTile = screen.getByText("Focus time").closest(".pp-tile") as HTMLElement;
    expect(within(focusTile).getByText("25 min")).toBeTruthy();
    expect(screen.getByText("Tasks completed per day")).toBeTruthy();
  });

  it("switches a chart to its table view", async () => {
    const db = new MemoryDatabase();
    await seed(db);
    await renderReports(db);
    await screen.findByText("Tasks completed per day");
    const card = screen.getByText("Tasks completed per day").closest(".ant-card") as HTMLElement;
    fireEvent.click(within(card).getByText("Table"));
    expect(await within(card).findByRole("columnheader", { name: "Completed" })).toBeTruthy();
  });

  it("exports the report as CSV", async () => {
    const db = new MemoryDatabase();
    await seed(db);
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob) => ((blob = b), "blob:test"));
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await renderReports(db);
    await screen.findByText("Tasks completed per day");
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    fireEvent.click(await screen.findByText("CSV, for spreadsheets"));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const csv = await blob!.text();
    expect(csv).toContain("Creedence report");
    expect(csv).toContain("Tasks completed,3");
    expect(csv).toContain("Focus minutes,25");
    click.mockRestore();
  });
});
