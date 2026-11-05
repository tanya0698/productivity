/**
 * The manifest is a contract with the shell and with the mobile and API
 * modules of the same key, so its identity is asserted here.
 */
import myModule from "../config/module";

describe("mymodule manifest", () => {
  it("declares the identity the shell routes from", () => {
    expect(myModule.key).toBe("mymodule");
    expect(myModule.basePath).toBe("/mymodule");
    expect(myModule.status).toBe("live");
  });
});