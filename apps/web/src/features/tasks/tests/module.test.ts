/**
 * The manifest is a contract with the shell and with the mobile and API
 * modules of the same key, so its identity is asserted here.
 */
import tasksModule from "../config/module";

describe("tasks manifest", () => {
  it("declares the identity the shell routes from", () => {
    expect(tasksModule.key).toBe("tasks");
    expect(tasksModule.basePath).toBe("/tasks");
    expect(tasksModule.status).toBe("live");
  });
});