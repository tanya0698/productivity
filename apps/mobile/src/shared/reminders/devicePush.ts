import * as Notifications from "expo-notifications";
import { API_URL } from "../data/openRuntime";

/**
 * Reminders pushed from the server through Firebase Cloud Messaging, as well
 * as the alarms the phone schedules itself. Android can hold back or drop an
 * app's own alarms (battery savers, force stop); a high-priority FCM push
 * still gets through. Both carry the same alert key as the notification's
 * identifier, so whichever arrives second replaces the first: never two.
 *
 * Needs google-services.json in the build (app.json → android.googleServicesFile)
 * and FIREBASE_SERVICE_ACCOUNT_FILE on the server.
 */

type Token = () => Promise<string | null>;

let current: string | null = null;

async function post(path: string, method: "POST" | "DELETE", token: string | null, body: object) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(`${path} answered HTTP ${res.status}${body?.message ? `: ${body.message}` : ""}`);
  }
  return res.status === 204 ? null : ((await res.json()) as unknown);
}

/** This phone's FCM token, or null if Firebase isn't in this build (no google-services.json). */
export async function devicePushToken(): Promise<string | null> {
  try {
    const t = await Notifications.getDevicePushTokenAsync();
    return typeof t.data === "string" ? t.data : null;
  } catch {
    return null;
  }
}

/** Tell the server where to push this account's reminders. Safe to call often. */
export async function registerDevicePush(getAccessToken: Token): Promise<boolean> {
  const token = await devicePushToken();
  if (!token) return false;
  await post("/push/devices", "POST", await getAccessToken(), { token, platform: "android" });
  current = token;
  return true;
}

/** Stop pushing to this phone (signing out). Best effort: offline, the server drops it once FCM says it's gone. */
export async function unregisterDevicePush(getAccessToken: Token): Promise<void> {
  const token = current ?? (await devicePushToken());
  if (!token) return;
  await post("/push/devices", "DELETE", await getAccessToken(), { token }).catch(() => undefined);
  current = null;
}

/** FCM renews tokens now and then; re-register when it does. */
export function onDevicePushTokenChange(getAccessToken: Token) {
  return Notifications.addPushTokenListener(() => void registerDevicePush(getAccessToken).catch(() => undefined));
}
