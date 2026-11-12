/**
 * Web push on this browser (plan §8.1): subscribe through the service worker
 * and tell the API, so the worker can send due reminders with the app closed.
 */

export type PushState = "unsupported" | "denied" | "off" | "on";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** The service worker, or null if it isn't running within a few seconds. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
}

const auth = (token: string | null): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Ask for permission, subscribe, and register the subscription with the API. */
export async function enablePush(token: string | null): Promise<PushState | "unavailable"> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const keyRes = await fetch("/api/push/key", { headers: auth(token) });
  if (!keyRes.ok) return "unavailable";
  const { publicKey } = (await keyRes.json()) as { publicKey: string };
  const reg = await registration();
  if (!reg) return "unavailable";
  const options = { userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) };
  let sub = await reg.pushManager.getSubscription();
  try {
    sub ??= await reg.pushManager.subscribe(options);
  } catch {
    // A subscription made with another server key: start over.
    await sub?.unsubscribe();
    sub = await reg.pushManager.subscribe(options);
  }
  const res = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth(token) },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) throw new Error(`Couldn't turn on notifications (${res.status}).`);
  return "on";
}

/** Stop push on this browser (also on sign-out, so the next person here doesn't get your reminders). */
export async function disablePush(token: string | null): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...auth(token) },
    body: JSON.stringify({ endpoint: sub.endpoint }),
    keepalive: true,
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
