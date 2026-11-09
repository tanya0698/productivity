import "fake-indexeddb/auto";
import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

// antd's first render is slow when every test file runs in parallel; the 1s default flakes.
configure({ asyncUtilTimeout: 10_000 });

afterEach(() => cleanup());

// jsdom has no ResizeObserver; antd's auto-sizing text box needs it.
window.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom has no matchMedia; antd's grid and our colour-mode hook need it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
