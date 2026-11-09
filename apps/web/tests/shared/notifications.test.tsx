import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntApp } from "antd";
import { MemoryRouter, useLocation } from "react-router-dom";
import { NotificationBell } from "@/shared/notifications/NotificationBell";
import { notificationStore } from "@/shared/notifications/store";

function Where() {
  return <output data-testid="path">{useLocation().pathname + useLocation().search}</output>;
}

const store = notificationStore("local");

beforeEach(() => {
  localStorage.clear();
  store.clear();
});

function renderBell() {
  return render(
    <AntApp>
      <MemoryRouter>
        <NotificationBell />
        <Where />
      </MemoryRouter>
    </AntApp>,
  );
}

describe("Notification centre", () => {
  it("counts unread notifications and lists them", async () => {
    renderBell();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    act(() => {
      store.add({ id: "r1", kind: "reminder", title: "Call the bank", body: "Reminder · now", href: "/reminders" });
      store.add({ id: "f1", kind: "focus", title: "Focus done: 25 minutes", href: "/focus" });
      store.add({ id: "r1", kind: "reminder", title: "Call the bank" }); // the same alert from another tab
    });
    fireEvent.click(await screen.findByRole("button", { name: "Notifications: 2 new" }));
    expect(await screen.findByText("Call the bank")).toBeTruthy();
    expect(screen.getByText("Focus done: 25 minutes")).toBeTruthy();
  });

  it("opens what a notification is about, and marks it read", async () => {
    renderBell();
    act(() => store.add({ id: "r1", kind: "reminder", title: "Call the bank", href: "/reminders" }));
    fireEvent.click(await screen.findByRole("button", { name: "Notifications: 1 new" }));
    fireEvent.click(await screen.findByText("Call the bank"));
    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/reminders"));
    expect(store.get()[0]!.read).toBe(true);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
  });

  it("marks everything read", async () => {
    renderBell();
    act(() => {
      store.add({ id: "a", kind: "info", title: "One" });
      store.add({ id: "b", kind: "info", title: "Two" });
    });
    fireEvent.click(await screen.findByRole("button", { name: "Notifications: 2 new" }));
    fireEvent.click(await screen.findByRole("button", { name: /Mark all read/ }));
    await waitFor(() => expect(store.get().every((n) => n.read)).toBe(true));
  });
});
