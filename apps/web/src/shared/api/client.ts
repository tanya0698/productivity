import { apiError, type ApiError } from "@productivity/contracts";

/**
 * A small fetch wrapper for the few server-only calls (search across devices,
 * file upload, AI). Synced records never go through here — they are read and
 * written in the local database and travel through /api/sync (plan §11.3).
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly body: ApiError | null;
  constructor(status: number, body: ApiError | null) {
    super(body?.error.message ?? `Request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    const parsed = apiError.safeParse(json);
    throw new ApiRequestError(res.status, parsed.success ? parsed.data : null);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** API helpers scoped to one module's prefix: `moduleApi("tasks").get("/x")` → GET /api/tasks/x. */
export function moduleApi(key: string) {
  return {
    get: <T>(path: string) => apiRequest<T>(`/${key}${path}`),
    post: <T>(path: string, body: unknown) =>
      apiRequest<T>(`/${key}${path}`, { method: "POST", body: JSON.stringify(body) }),
  };
}
