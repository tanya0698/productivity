import { pullResponse, pushResponse } from "@productivity/contracts";
import { AuthSyncError, TransientSyncError, type SyncTransport } from "./index.ts";

/**
 * The transport to /api/sync. Sorts failures into the kinds the engine treats
 * differently: retry later (network, 5xx), sign in again (401/403), or a bug
 * that retrying won't fix (other 4xx, a response that doesn't match the contract).
 */
export function createHttpTransport(
  baseUrl: string,
  options: {
    /** The signed-in user's current access token; asked for on every request, so refreshes are picked up. */
    getAccessToken?: () => Promise<string | null>;
    fetchImpl?: typeof fetch;
  } = {},
): SyncTransport {
  const root = baseUrl.replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await options.getAccessToken?.();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    let res: Response;
    try {
      res = await fetchImpl(`${root}${path}`, { ...init, headers });
    } catch (err) {
      throw new TransientSyncError(`Network error: ${String(err)}`);
    }
    if (res.status === 401 || res.status === 403) throw new AuthSyncError(`Sync refused (${res.status}).`);
    if (res.status >= 500) throw new TransientSyncError(`Server error (${res.status}).`);
    if (!res.ok) throw new Error(`Sync request failed (${res.status}): ${await res.text()}`);
    try {
      return await res.json();
    } catch (err) {
      // A proxy or captive portal answering with HTML, not the API.
      throw new TransientSyncError(`Unreadable response: ${String(err)}`);
    }
  }

  return {
    push: async (body) =>
      pushResponse.parse(
        await request("/sync/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      ),
    pull: async (cursor) => pullResponse.parse(await request(`/sync/pull?cursor=${cursor}`)),
  };
}
