import { useCallback } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MemoryDatabase, type LocalRecord } from "@productivity/database-local";
import { SyncRuntime, type SyncTransport } from "@productivity/sync-engine";
import { SyncProvider } from "@productivity/sync-engine/react";
import { localDate, newGoal, newHabit, newHabitLog, newProject, startTimer } from "@productivity/domain";
import HabitsPage from "@/features/habits/pages/HomePage";
import FocusPage from "@/features/focus/pages/HomePage";
import GoalsFeature from "@/features/goals";
import { FocusWatcher } from "@/shared/focus/FocusWatcher";
import { timerStore } from "@/shared/focus/timerStore";

const unused: SyncTransport = {
  push: async () => ({ results: [] }),
  pull: async (cursor) => ({ changes: [], cursor, hasMore: false }),
};

function renderWith(db: MemoryDatabase, ui: React.ReactNode, path = "/") {
  const runtime = new SyncRuntime({ db, transport: unused, deviceId: crypto.randomUUID(), newId: () => crypto.randomUUID() });
  vi.spyOn(runtime, "start").mockImplementation(() => {});
  function Harness() {
    const open = useCallback(async () => runtime, []);
    return (
      <SyncProvider open={open} failed={() => null}>
        <AntApp>
          <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
        </AntApp>
      </SyncProvider>
    );
  }
  return render(<Harness />);
}

const put = (db: MemoryDatabase, entity: "habit" | "habit_log" | "goal" | "project", r: object) =>
  db.transaction((tx) => tx.put(entity, r as LocalRecord, "synced"));
const live = async (db: MemoryDatabase, entity: "habit_log" | "focus_session" | "goal_milestone") => db.list(entity);

beforeEach(() => {
  localStorage.clear();
  timerStore("local").set({ timer: null, finished: null });
});

describe("Habits", () => {
  it("ticks a habit and unticks it again", async () => {
    const db = new MemoryDatabase();
    const h = newHabit(crypto.randomUUID(), new Date(), { title: "Read" });
    await put(db, "habit", h);
    renderWith(db, <HabitsPage />);

    fireEvent.click(await screen.findByRole("button", { name: 'Mark "Read" as done' }));
    await waitFor(async () => expect(await live(db, "habit_log")).toHaveLength(1));
    expect((await live(db, "habit_log"))[0]).toMatchObject({ habitId: h.id, date: localDate(new Date()), count: 1 });
    expect(await screen.findByText(/1-day streak/)).toBeTruthy();

    fireEvent.click(await screen.findByRole("button", { name: 'Mark "Read" as not done' }));
    await waitFor(async () => expect(await live(db, "habit_log")).toHaveLength(0));
  });

  it("counts towards a target with + and −", async () => {
    const db = new MemoryDatabase();
    const h = newHabit(crypto.randomUUID(), new Date(), { title: "Water", targetCount: 3 });
    await put(db, "habit", h);
    await put(db, "habit_log", newHabitLog(crypto.randomUUID(), new Date(), h.id, localDate(new Date()), 2));
    renderWith(db, <HabitsPage />);

    expect(await screen.findByText("2/3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add one to Water" }));
    expect(await screen.findByText("3/3")).toBeTruthy();
    expect(await screen.findByText(/1-day streak/)).toBeTruthy();
  });

  it("adds a weekly habit", async () => {
    const db = new MemoryDatabase();
    renderWith(db, <HabitsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /New habit/ }));
    fireEvent.change(await screen.findByLabelText("Habit"), { target: { value: "Gym" } });
    fireEvent.click(screen.getByText("Weekly"));
    fireEvent.change(await screen.findByLabelText("Times a week"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Add habit" }));
    await waitFor(async () => expect(await db.list("habit")).toHaveLength(1));
    expect((await db.list("habit"))[0]).toMatchObject({ title: "Gym", cadence: "weekly", targetCount: 3, daysOfWeek: null });
  }, 15000);
});

describe("Focus", () => {
  it("starts a timer that shows in the page", async () => {
    renderWith(new MemoryDatabase(), <FocusPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Start focus/ }));
    expect(await screen.findByRole("button", { name: /Pause/ })).toBeTruthy();
    expect(timerStore("local").get().timer).toMatchObject({ kind: "focus", plannedMinutes: 25 });
  });

  it("saves a session stopped early, as not completed", async () => {
    const db = new MemoryDatabase();
    const t = startTimer("focus", 25, {}, new Date(Date.now() - 10 * 60_000));
    timerStore("local").set({ timer: { ...t, sessionId: crypto.randomUUID() } });
    renderWith(db, <FocusPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Stop/ }));
    await waitFor(async () => expect(await live(db, "focus_session")).toHaveLength(1));
    const [s] = await live(db, "focus_session");
    expect(s).toMatchObject({ completed: false, kind: "focus" });
    expect(Math.round((s!.durationSeconds as number) / 60)).toBe(10);
    expect(timerStore("local").get().timer).toBeNull();
  });

  it("finishes a timer that ran out, once, and offers a break", async () => {
    const db = new MemoryDatabase();
    const sessionId = crypto.randomUUID();
    const t = startTimer("focus", 25, {}, new Date(Date.now() - 26 * 60_000));
    timerStore("local").set({ timer: { ...t, sessionId } });
    renderWith(
      db,
      <>
        <FocusWatcher />
        <FocusPage />
      </>,
    );
    expect(await screen.findByText("Focus done: 25 minutes")).toBeTruthy();
    await waitFor(async () => expect(await live(db, "focus_session")).toHaveLength(1));
    expect((await live(db, "focus_session"))[0]).toMatchObject({ id: sessionId, completed: true, durationSeconds: 1500 });
    expect(await screen.findByRole("button", { name: /Start 5-min break/ })).toBeTruthy();
  });
});

describe("Goals", () => {
  const goalsAt = (db: MemoryDatabase, path: string) =>
    renderWith(
      db,
      <Routes>
        <Route path="/goals/*" element={<GoalsFeature />} />
      </Routes>,
      path,
    );

  it("adds milestones and counts progress", async () => {
    const db = new MemoryDatabase();
    const g = newGoal(crypto.randomUUID(), new Date(), { title: "Run a half marathon" });
    await put(db, "goal", g);
    goalsAt(db, `/goals/${g.id}`);

    for (const title of ["Run 5 km", "Run 10 km"]) {
      fireEvent.change(await screen.findByLabelText("New milestone"), { target: { value: title } });
      // antd ignores a second Enter until the key comes back up, as a real keyboard does.
      fireEvent.keyDown(screen.getByLabelText("New milestone"), { key: "Enter", code: "Enter", keyCode: 13 });
      fireEvent.keyUp(screen.getByLabelText("New milestone"), { key: "Enter", code: "Enter", keyCode: 13 });
      await screen.findByText(title);
    }
    expect(await live(db, "goal_milestone")).toHaveLength(2);
    fireEvent.click(screen.getByRole("checkbox", { name: "Run 5 km" }));
    expect(await screen.findByText("1 of 2 milestones")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("links a project to the goal", async () => {
    const db = new MemoryDatabase();
    const g = newGoal(crypto.randomUUID(), new Date(), { title: "Get fit" });
    const p = newProject(crypto.randomUUID(), new Date(), { title: "Training plan" });
    await put(db, "goal", g);
    await put(db, "project", p);
    goalsAt(db, `/goals/${g.id}`);

    fireEvent.mouseDown(await screen.findByLabelText("Link a project"));
    fireEvent.click(await screen.findByText("Training plan"));
    await waitFor(async () => expect(await db.get("project", p.id)).toMatchObject({ goalId: g.id }));
    expect(await screen.findByRole("button", { name: "Unlink Training plan" })).toBeTruthy();
  });

  it("asks for a review when one is due", async () => {
    const db = new MemoryDatabase();
    const longAgo = new Date(Date.now() - 40 * 86_400_000);
    const g = newGoal(crypto.randomUUID(), longAgo, { title: "Save a deposit", reviewCadence: "monthly" });
    await put(db, "goal", g);
    goalsAt(db, `/goals/${g.id}`);
    fireEvent.click(await screen.findByRole("button", { name: "Mark reviewed" }));
    await waitFor(async () => expect((await db.get("goal", g.id))?.lastReviewedAt).toBeTruthy());
  });
});
