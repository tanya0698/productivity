/**
 * The manifest is a contract with the shell and with the mobile and API
 * modules of the same key, so its identity is asserted here.
 */
import projectsModule from "../config/module";

describe("projects manifest", () => {
  it("declares the identity the shell routes from", () => {
    expect(projectsModule.key).toBe("projects");
    expect(projectsModule.basePath).toBe("/projects");
    expect(projectsModule.entities).toEqual(["project"]);
    expect(projectsModule.status).toBe("live");
  });
});
