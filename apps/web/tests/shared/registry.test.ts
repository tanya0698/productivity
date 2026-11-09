/**
 * Asserts against the real modules in src/features, so a malformed manifest
 * or a module that stops being discovered fails here.
 */
import { findModuleByPath, getModules, registryProblems } from "@/shared/modules/registry";

describe("module registry", () => {
  it("discovers the modules in src/features", () => {
    expect(getModules().map((m) => m.key)).toEqual(expect.arrayContaining(["tasks", "calendar", "projects", "reminders", "notes", "goals", "habits", "focus", "reports"]));
  });

  it("has no key/folder mismatch, duplicate key or duplicate route", () => {
    expect(registryProblems()).toEqual([]);
  });

  it("sorts by order", () => {
    const keys = getModules().map((m) => m.key);
    expect(keys.indexOf("tasks")).toBeLessThan(keys.indexOf("notes"));
  });

  it("resolves a path to the module that owns it, and only on a segment boundary", () => {
    expect(findModuleByPath("/tasks")?.key).toBe("tasks");
    expect(findModuleByPath("/tasks/today")?.key).toBe("tasks");
    expect(findModuleByPath("/tasksheet")).toBeUndefined();
    expect(findModuleByPath("/")).toBeUndefined();
  });
});
