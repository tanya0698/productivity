/**
 * Pure business rules shared by every client and the server.
 *
 * Nothing here touches storage, the network or the clock implicitly — time is
 * always passed in — so the same rule gives the same answer on the phone, in
 * the browser and in the worker, and is trivially unit-tested.
 */
export * from "./tasks.ts";
export * from "./notes.ts";
export * from "./projects.ts";
export * from "./search.ts";
