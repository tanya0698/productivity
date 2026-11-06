import { useCallback } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter } from "react-router-dom";
import { MemoryDatabase } from "@productivity/database-local";
import { SyncRuntime, type SyncTransport } from "@productivity/sync-engine";
import { SyncProvider } from "@productivity/sync-engine/react";
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
  return render(<Harness />);
}

describe("Today", () => {
  it("quick capture saves a note on Enter and clears the box", async () => {
    const db = new MemoryDatabase();
    renderToday(db);
    const box = (await screen.findByLabelText("Quick capture")) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "Call the bank about the card" } });
    fireEvent.keyDown(box, { key: "Enter", code: "Enter", keyCode: 13 });

    await waitFor(async () => {
      const [note] = await db.list("note");
      expect(note).toMatchObject({ bodyText: "Call the bank about the card" });
    });
    await waitFor(() => expect(box.value).toBe(""));
    expect(await screen.findByText("Saved to Notes")).toBeTruthy();
  });

  it("ignores Enter on an empty box", async () => {
    const db = new MemoryDatabase();
    renderToday(db);
    const box = await screen.findByLabelText("Quick capture");
    fireEvent.change(box, { target: { value: "   " } });
    fireEvent.keyDown(box, { key: "Enter", code: "Enter", keyCode: 13 });
    await new Promise((r) => setTimeout(r, 50));
    expect(await db.list("note")).toHaveLength(0);
  });
});
