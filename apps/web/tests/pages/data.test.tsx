import { useCallback } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryDatabase, type LocalRecord } from "@productivity/database-local";
import { SyncRuntime, type SyncTransport } from "@productivity/sync-engine";
import { SyncProvider } from "@productivity/sync-engine/react";
import { buildBackup, newGoal, newHabit, newHabitLog, newProject, newTask } from "@productivity/domain";
import { DataCard } from "@/pages/account/DataCard";

const unused: SyncTransport = {
  push: async () => ({ results: [] }),
  pull: async (cursor) => ({ changes: [], cursor, hasMore: false }),
};

function renderCard(db: MemoryDatabase) {
  const runtime = new SyncRuntime({ db, transport: unused, deviceId: crypto.randomUUID(), newId: () => crypto.randomUUID() });
  vi.spyOn(runtime, "start").mockImplementation(() => {});
  function Harness() {
    const open = useCallback(async () => runtime, []);
    return (
      <SyncProvider open={open} failed={() => null}>
        <AntApp>
          <DataCard />
        </AntApp>
      </SyncProvider>
    );
  }
  return render(<Harness />);
}

const now = new Date();
function sample() {
  const goal = newGoal(crypto.randomUUID(), now, { title: "Get fit" });
  const project = { ...newProject(crypto.randomUUID(), now, { title: "Training plan" }), goalId: goal.id };
  const task = newTask(crypto.randomUUID(), now, { title: "Buy running shoes", projectId: project.id });
  const habit = newHabit(crypto.randomUUID(), now, { title: "Run" });
  const log = newHabitLog(crypto.randomUUID(), now, habit.id, "2026-11-08");
  return { goal, project, task, habit, log };
}

const upload = async (text: string) => {
  await screen.findByRole("button", { name: /Import backup/ }); // the card is up
  const input = screen.getByLabelText("Backup file") as HTMLInputElement;
  const file = new File([text], "backup.json", { type: "application/json" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
};

describe("Your data", () => {
  it("exports everything on the device as a JSON download", async () => {
    const db = new MemoryDatabase();
    const s = sample();
    await db.transaction(async (tx) => {
      await tx.put("goal", s.goal as unknown as LocalRecord, "synced");
      await tx.put("task", s.task as unknown as LocalRecord, "synced");
    });
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob) => ((blob = b), "blob:test"));
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderCard(db);

    fireEvent.click(await screen.findByRole("button", { name: /Export backup/ }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const backup = JSON.parse(await blob!.text());
    expect(backup).toMatchObject({ format: "productivity-backup", version: 1 });
    expect(backup.data.goal[0]).toMatchObject({ id: s.goal.id, title: "Get fit" });
    expect(backup.data.task[0]).toMatchObject({ title: "Buy running shoes" });
    click.mockRestore();
  });

  it("previews then imports into another account, with fresh ids and links kept", async () => {
    const db = new MemoryDatabase();
    const s = sample();
    const backup = buildBackup({ goal: [s.goal], project: [s.project], task: [s.task], habit: [s.habit], habit_log: [s.log] }, now);
    renderCard(db);
    await upload(JSON.stringify(backup));

    expect(await screen.findByRole("button", { name: "Import 5 items" })).toBeTruthy();
    expect(screen.getByText("projects")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Import 5 items" }));

    await waitFor(async () => expect(await db.list("habit_log")).toHaveLength(1));
    const [goal] = await db.list("goal");
    const [project] = await db.list("project");
    const [task] = await db.list("task");
    const [habit] = await db.list("habit");
    const [log] = await db.list("habit_log");
    expect(goal!.id).not.toBe(s.goal.id);
    expect(project).toMatchObject({ title: "Training plan", goalId: goal!.id });
    expect(task).toMatchObject({ projectId: project!.id });
    expect(log).toMatchObject({ habitId: habit!.id });
    // Queued to sync, as new records.
    const queued = await db.pendingOperations(50);
    expect(queued).toHaveLength(5);
    expect(queued.every((q) => q.operation.baseVersion === null)).toBe(true);
  });

  it("skips what's already here, so importing twice adds nothing", async () => {
    const db = new MemoryDatabase();
    const s = sample();
    await db.transaction(async (tx) => {
      await tx.put("goal", s.goal as unknown as LocalRecord, "synced");
      await tx.put("project", s.project as unknown as LocalRecord, "synced");
    });
    renderCard(db);
    await upload(JSON.stringify(buildBackup({ goal: [s.goal], project: [s.project] }, now)));
    expect(await screen.findByRole("button", { name: "Nothing to import" })).toBeTruthy();
    expect(screen.getAllByText(/1 already here/)).toHaveLength(2);
  });

  it("says plainly when a file isn't a backup", async () => {
    renderCard(new MemoryDatabase());
    await upload('{"hello": "world"}');
    expect(await screen.findByText("This isn't a Creedence backup file.")).toBeTruthy();
  });
});
