import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The repo root (where the .env lives): relative key paths are read from here. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * Push to the Android app through Firebase Cloud Messaging (HTTP v1), used by
 * the worker (due reminders) and the API (a test push).
 *
 * Messages are data-only and high priority, shaped the way expo-notifications
 * reads them on the phone: `title`, `message`, `body` (the JSON the app gets
 * as notification.data), `channelId`, `categoryId` (the Snooze / Done /
 * Dismiss buttons) and `tag`, which becomes the notification's identifier.
 * The phone schedules its own alarm for the same alert under the same
 * identifier, so whichever arrives second replaces the first: never two.
 *
 * Credentials: a Firebase service account (Project settings → Service accounts
 * → Generate new private key), as a file named by FIREBASE_SERVICE_ACCOUNT_FILE
 * in the root .env (relative to the repo root, or absolute). It's a secret:
 * the repo's .gitignore keeps firebase-service-account*.json out of git.
 */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface DevicePush {
  title: string;
  body: string;
  /** Same tag, same notification: replaces rather than stacks. */
  tag: string;
  /** What the app receives as notification.request.content.data. */
  data: Record<string, string>;
  /** Android notification channel (the app creates "reminders"). */
  channelId?: string;
  /** Action buttons registered by the app ("reminder", "task-reminder"). */
  categoryId?: string;
  /** Seconds FCM keeps trying to deliver. */
  ttlSeconds?: number;
}

/** "gone": the token no longer exists (app removed or data cleared); delete it. */
export type DeviceResult = "ok" | "gone" | "failed";

export interface FcmSender {
  projectId: string;
  send(token: string, push: DevicePush): Promise<DeviceResult>;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** The sender, or null when FIREBASE_SERVICE_ACCOUNT_FILE isn't set (phone push off). */
export function fcmFromEnv(env: NodeJS.ProcessEnv = process.env): FcmSender | null {
  const file = env.FIREBASE_SERVICE_ACCOUNT_FILE;
  if (!file) return null;
  const account = JSON.parse(readFileSync(isAbsolute(file) ? file : resolve(ROOT, file), "utf8")) as ServiceAccount;
  if (!account.project_id || !account.client_email || !account.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_FILE isn't a Firebase service account key.");
  }
  return createFcmSender(account);
}

export function createFcmSender(account: ServiceAccount): FcmSender {
  let cached: { token: string; until: number } | null = null;

  /** An OAuth access token for FCM, from a signed JWT (no Google SDK needed). */
  async function accessToken(): Promise<string> {
    if (cached && cached.until > Date.now() + 60_000) return cached.token;
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(
      JSON.stringify({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    );
    const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${b64url(signature)}` }),
    });
    if (!res.ok) throw new Error(`Firebase sign-in failed (HTTP ${res.status}). Check the service account key.`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    cached = { token: body.access_token, until: Date.now() + body.expires_in * 1000 };
    return cached.token;
  }

  return {
    projectId: account.project_id,
    async send(token, push) {
      const data: Record<string, string> = {
        title: push.title,
        message: push.body,
        body: JSON.stringify(push.data),
        tag: push.tag,
        sound: "default",
      };
      if (push.channelId) data.channelId = push.channelId;
      if (push.categoryId) data.categoryId = push.categoryId;
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: { token, data, android: { priority: "HIGH", ttl: `${push.ttlSeconds ?? 3600}s` } },
        }),
      });
      if (res.ok) return "ok";
      const err = (await res.json().catch(() => null)) as { error?: { status?: string; details?: { errorCode?: string }[] } } | null;
      const code = err?.error?.details?.find((d) => d.errorCode)?.errorCode ?? err?.error?.status;
      // UNREGISTERED: the app was removed or its data cleared. A malformed token is just as dead.
      if (res.status === 404 || code === "UNREGISTERED" || (res.status === 400 && code === "INVALID_ARGUMENT")) return "gone";
      console.error(`[push] FCM send failed (HTTP ${res.status}${code ? `, ${code}` : ""})`);
      return "failed";
    },
  };
}
