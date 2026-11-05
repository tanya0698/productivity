import { fireEvent, render, screen } from "@testing-library/react";
import App from "@/App";

describe("App", () => {
  // jsdom reports a narrow screen, so this exercises the phone layout: the
  // sidebar lives in a drawer behind the menu button.
  it("opens on Today, with every module in the navigation", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Today" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(await screen.findByText("Tasks")).toBeTruthy();
    expect(screen.getByText("Notes")).toBeTruthy();
  });

  it("shows a not-found page for an unknown address", async () => {
    window.history.pushState({}, "", "/nowhere");
    render(<App />);
    expect(await screen.findByText("Page not found")).toBeTruthy();
  });
});
