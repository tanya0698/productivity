import { useCallback } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter } from "react-router-dom";
import { MemoryDatabase, type LocalRecord } from "@productivity/database-local";
import { SyncRuntime, type SyncTransport } from "@productivity/sync-engine";
import { SyncProvider } from "@productivity/sync-engine/react";
import { newReminder, newTask } from "@productivity/domain";
import RemindersPage from "@/features/reminders/pages/HomePage";
import { TaskEditor } from "@/shared/tasks/TaskEditor";
import { ReminderAlerts } from "@/shared/reminders/ReminderAlerts";

const unused: SyncTransport = {
  push: async () => ({ results: [] }),
  pull: async (cursor) => ({ changes: [], cursor, hasMore: false }),
};

function renderWith(db: MemoryDatabase, ui: React.ReactNode) {
  const runtime = new SyncRuntime({ db, transport: unused, deviceId: crypto.randomUUID(), newId: () => crypto.randomUUID() });
  vi.spyOn(runtime, "start").mockImplementation(() => {});
  function Harness() {
    const open = useCallback(async () => runtime, []);
    return (
      <SyncProvider open={open} failed={() => null}>
        <AntApp>
          <MemoryRouter>{ui}</MemoryRouter>
        </AntApp>
      </SyncProvider>
    );
  }
  return render(<Harness />);
}

const put = (db: MemoryDatabase, entity: "task" | "reminder", r: object) =>
  db.transaction((tx) => tx.put(entity, r as LocalRecord, "synced"));

beforeEach(() => localStorage.clear());

describe("Reminders page", () => {
  it("shows a due reminder under Due now and dismisses it", async () => {
    const db = new MemoryDatabase();
    const now = new Date();
    const r = newReminder(crypto.randomUUID(), now, { remindAt: new Date(now.getTime() - 5 * 60_000), timezone: "UTC", title: "Call the bank" });
    await put(db, "reminder", r);
    renderWith(db, <RemindersPage />);

    expect(await screen.findByText(/Due now · 1/)).toBeTruthy();
    expect(screen.getByText("Call the bank")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(async () => expect(await db.get("reminder", r.id)).toMatchObject({ status: "dismissed" }));
    expect(await screen.findByText(/Dismissed lately · 1/)).toBeTruthy();
  });

  it("adds a standalone reminder", async () => {
    const db = new MemoryDatabase();
    renderWith(db, <RemindersPage />);
    fireEvent.click(await screen.findByRole("button", { name: /New reminder/ }));
    fireEvent.change(await screen.findByLabelText("Remind me to"), { target: { value: "Water the plants" } });
    fireEvent.click(screen.getByRole("button", { name: "Add reminder" }));
    await waitFor(async () => expect(await db.list("reminder")).toHaveLength(1));
    const [saved] = await db.list("reminder");
    expect(saved).toMatchObject({ title: "Water the plants", status: "scheduled", recurrenceRule: null });
    expect(new Date(saved!.remindAt as string).getTime()).toBeGreaterThan(Date.now());
  }, 15000);
});

describe("Task editor reminders", () => {
  it("saves a due time and a reminder 1 hour before", async () => {
    const db = new MemoryDatabase();
    const now = new Date();
    const due = new Date(now.getTime() + 2 * 86_400_000);
    due.setHours(14, 30, 0, 0);
    const task = { ...newTask(crypto.randomUUID(), now, { title: "Dentist" }), dueAt: due.toISOString() };
    await put(db, "task", task);
    const onSave = vi.fn();
    renderWith(db, <TaskEditor task={{ ...task, deletedAt: null }} projects={[]} onClose={() => {}} onSave={onSave} onDelete={() => {}} />);

    const panel = await screen.findByRole("dialog");
    // Wait for the form to load the task: the time field shows its due time.
    await waitFor(() => expect((within(panel).getByLabelText("Time") as HTMLInputElement).value).toBe("14:30"));
    fireEvent.mouseDown(within(panel).getByLabelText("Reminder"));
    fireEvent.click(await screen.findByText("1 hour before"));
    fireEvent.click(within(panel).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueAt: due.toISOString(), dueDate: null })));
    await waitFor(async () => expect(await db.list("reminder")).toHaveLength(1));
    const [r] = await db.list("reminder");
    expect(r).toMatchObject({ taskId: task.id, remindAt: new Date(due.getTime() - 3600_000).toISOString() });
  }, 15000);
});

describe("Task editor keeps an existing reminder", () => {
  it("saving without touching the reminder leaves it alone", async () => {
    const db = new MemoryDatabase();
    const now = new Date();
    const due = new Date(now.getTime() + 2 * 86_400_000);
    due.setSeconds(0, 0); // due times are whole minutes, as the editor saves them
    const task = { ...newTask(crypto.randomUUID(), now, { title: "Dentist" }), dueAt: due.toISOString() };
    const reminder = newReminder(crypto.randomUUID(), now, { remindAt: new Date(due.getTime() - 600_000), timezone: "UTC", taskId: task.id });
    await put(db, "task", task);
    await put(db, "reminder", reminder);
    renderWith(db, <TaskEditor task={{ ...task, deletedAt: null }} projects={[]} onClose={() => {}} onSave={() => {}} onDelete={() => {}} />);

    const panel = await screen.findByRole("dialog");
    await waitFor(() => expect(within(panel).getByText("10 minutes before")).toBeTruthy());
    fireEvent.click(within(panel).getByRole("button", { name: "Save" }));
    await new Promise((res) => setTimeout(res, 200));
    expect(await db.get("reminder", reminder.id)).toMatchObject({ deletedAt: null, remindAt: reminder.remindAt });
    expect(await db.pendingOperations(10)).toHaveLength(0);
  }, 15000);
});

describe("Reminder alerts", () => {
  it("alerts once for a due reminder, and Dismiss settles it", async () => {
    const db = new MemoryDatabase();
    const now = new Date();
    const r = newReminder(crypto.randomUUID(), now, { remindAt: new Date(now.getTime() - 60_000), timezone: "UTC", title: "Stand up and stretch" });
    await put(db, "reminder", r);
    renderWith(db, <ReminderAlerts />);

    expect(await screen.findByText("Stand up and stretch")).toBeTruthy();
    expect(screen.getAllByText("Stand up and stretch")).toHaveLength(1);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    });
    await waitFor(async () => expect(await db.get("reminder", r.id)).toMatchObject({ status: "dismissed" }));
  });

  it("doesn't alert for a reminder on a task that's done", async () => {
    const db = new MemoryDatabase();
    const now = new Date();
    const task = { ...newTask(crypto.randomUUID(), now, { title: "Finished thing" }), status: "done" as const, completedAt: now.toISOString() };
    await put(db, "task", task);
    await put(db, "reminder", newReminder(crypto.randomUUID(), now, { remindAt: new Date(now.getTime() - 60_000), timezone: "UTC", taskId: task.id }));
    renderWith(db, <ReminderAlerts />);
    await new Promise((res) => setTimeout(res, 300));
    expect(screen.queryByText("Finished thing")).toBeNull();
  });
});
