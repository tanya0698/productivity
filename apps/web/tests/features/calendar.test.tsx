import { useCallback } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter } from "react-router-dom";
import { MemoryDatabase, type LocalRecord } from "@productivity/database-local";
import { SyncRuntime, type SyncTransport } from "@productivity/sync-engine";
import { SyncProvider } from "@productivity/sync-engine/react";
import { localDate, newEvent, newTask } from "@productivity/domain";
import CalendarPage from "@/features/calendar/pages/CalendarPage";

const unused: SyncTransport = {
  push: async () => ({ results: [] }),
  pull: async (cursor) => ({ changes: [], cursor, hasMore: false }),
};

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
            <CalendarPage />
          </MemoryRouter>
        </AntApp>
      </SyncProvider>
    );
  }
  return render(<Harness />);
}

const put = (db: MemoryDatabase, entity: "event" | "task", r: object) =>
  db.transaction((tx) => tx.put(entity, r as LocalRecord, "synced"));

// A fixed Monday, so the week is predictable.
const MONDAY = "2026-11-09";
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m);

beforeEach(() => localStorage.clear());

describe("Calendar", () => {
  it("shows events and dated tasks in the week", async () => {
    const db = new MemoryDatabase();
    const now = new Date();
    await put(db, "event", newEvent(crypto.randomUUID(), now, { title: "Dentist" }, { allDay: false, start: at(11, 14), end: at(11, 15), timezone: tz }));
    await put(db, "event", newEvent(crypto.randomUUID(), now, { title: "Conference" }, { allDay: true, startDate: "2026-11-12", endDate: "2026-11-14" }));
    await put(db, "task", newTask(crypto.randomUUID(), now, { title: "Pay rent", dueDate: "2026-11-10" }));
    renderAt(db, `/calendar?view=week&date=${MONDAY}`);

    expect(await screen.findByRole("button", { name: /Dentist, 14:00–15:00/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Conference" })).toHaveLength(2); // Thu and Fri
    expect(screen.getByRole("button", { name: "Pay rent" })).toBeTruthy();
    expect(screen.getByText(/9–15 Nov 2026/)).toBeTruthy();
  });

  it("adds an event", async () => {
    const db = new MemoryDatabase();
    renderAt(db, `/calendar?view=week&date=${MONDAY}`);
    fireEvent.click(await screen.findByRole("button", { name: /New event/ }));
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Lunch with Sam" } });
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    await waitFor(async () => expect(await db.list("event")).toHaveLength(1));
    const [ev] = await db.list("event");
    expect(ev).toMatchObject({ title: "Lunch with Sam", allDay: false, localStart: `${MONDAY}T09:00:00`, localEnd: `${MONDAY}T10:00:00`, timezone: tz });
  }, 15000);

  it("deletes just one occurrence of a repeating event", async () => {
    const db = new MemoryDatabase();
    const ev = newEvent(crypto.randomUUID(), new Date(), { title: "Stand-up", recurrenceRule: "FREQ=DAILY" }, { allDay: false, start: at(9, 9), end: at(9, 9, 15), timezone: tz });
    await put(db, "event", ev);
    renderAt(db, `/calendar?view=week&date=${MONDAY}`);

    const all = await screen.findAllByRole("button", { name: /Stand-up/ });
    expect(all).toHaveLength(7);
    fireEvent.click(all[2]!); // Wednesday
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText("This event")).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Delete event" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(async () => expect(await db.list("event_exception")).toHaveLength(1));
    expect((await db.list("event_exception"))[0]).toMatchObject({ eventId: ev.id, originalOccurrence: "2026-11-11T09:00:00", cancelled: true });
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Stand-up/ })).toHaveLength(6));
    expect(await db.get("event", ev.id)).toMatchObject({ deletedAt: null });
  }, 15000);

  it("moves a one-off event by dragging it down an hour", async () => {
    const db = new MemoryDatabase();
    const ev = newEvent(crypto.randomUUID(), new Date(), { title: "Review" }, { allDay: false, start: at(10, 14), end: at(10, 15), timezone: tz });
    await put(db, "event", ev);
    renderAt(db, `/calendar?view=week&date=${MONDAY}`);

    const block = await screen.findByRole("button", { name: /Review/ });
    fireEvent.pointerDown(block, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(block, { clientX: 100, clientY: 148, pointerId: 1 }); // 48px = 1 hour
    fireEvent.pointerUp(block, { clientX: 100, clientY: 148, pointerId: 1 });

    await waitFor(async () => expect(await db.get("event", ev.id)).toMatchObject({ localStart: "2026-11-10T15:00:00", localEnd: "2026-11-10T16:00:00" }));
    expect(screen.queryByRole("dialog")).toBeNull(); // a drag doesn't also open the event
  });

  it("lists the coming days in the agenda", async () => {
    const db = new MemoryDatabase();
    const today = localDate(new Date());
    await put(db, "task", newTask(crypto.randomUUID(), new Date(), { title: "Renew licence", dueDate: today }));
    renderAt(db, `/calendar?view=agenda&date=${today}`);
    expect(await screen.findByText("Renew licence")).toBeTruthy();
    expect(screen.getByText(/^Today ·/)).toBeTruthy();
  });
});
