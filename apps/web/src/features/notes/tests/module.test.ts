/**
 * The manifest is a contract with the shell and with the mobile and API
 * modules of the same key, so its identity is asserted here.
 */
import notesModule from "../config/module";

describe("notes manifest", () => {
  it("declares the identity the shell routes from", () => {
    expect(notesModule.key).toBe("notes");
    expect(notesModule.basePath).toBe("/notes");
    expect(notesModule.status).toBe("live");
  });
});