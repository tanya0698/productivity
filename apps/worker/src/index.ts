/**
 * Background worker (plan §8.1): outbox processing, reminder scheduling,
 * later AI and automation jobs. Runs as its own process from the same repo,
 * started with Node 24's type stripping — no build step.
 *
 * Jobs: a heartbeat, and push for due reminders: to browsers (when VAPID_* is
 * set) and to the Android app (when FIREBASE_SERVICE_ACCOUNT_FILE is set).
 */
import prismaPkg from "@prisma/client";
import webpush from "web-push";
import { fcmFromEnv } from "@productivity/push";
import { pushDueReminders, type Deliver } from "./pushReminders.ts";

const { PrismaClient } = prismaPkg;

interface Job {
  name: string;
  /** How often to run, in milliseconds. */
  everyMs: number;
  run(signal: AbortSignal): Promise<void>;
}

const jobs: Job[] = [
  {
    name: "heartbeat",
    everyMs: 60_000,
    async run() {
      console.log(`[worker] alive ${new Date().toISOString()}`);
    },
  },
  // Later: { name: "outbox", everyMs: 2_000, run: processOutbox },
];

const vapid =
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
        subject: process.env.VAPID_SUBJECT || "mailto:notifications@example.com",
      }
    : null;
const prisma = new PrismaClient();

let fcm: ReturnType<typeof fcmFromEnv> = null;
try {
  fcm = fcmFromEnv();
} catch (e) {
  console.error(`[worker] phone push is off: ${e instanceof Error ? e.message : e}`);
}
if (!fcm) console.log("[worker] FIREBASE_SERVICE_ACCOUNT_FILE not set: phone push is off");

let deliver: Deliver | null = null;
if (vapid) {
  deliver = async (sub, payload) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
        vapidDetails: vapid,
        TTL: 60 * 60, // an hour: an alert older than that is no longer useful
        urgency: "high",
      });
      return "ok";
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "gone";
      console.error(`[worker] push failed (HTTP ${status ?? "?"})`);
      return "failed";
    }
  };
} else {
  console.log("[worker] VAPID_* not set: web push is off");
}

if (deliver || fcm) {
  const device = fcm ? fcm.send.bind(fcm) : null;
  jobs.push({
    name: "push-reminders",
    everyMs: 30_000,
    async run() {
      const { sent, alerts } = await pushDueReminders(prisma, new Date(), { web: deliver, device });
      if (alerts) console.log(`[worker] pushed ${alerts} reminder(s) to ${sent} browser(s) and phone(s)`);
    },
  });
}

const controller = new AbortController();
const timers: NodeJS.Timeout[] = [];

for (const job of jobs) {
  let running = false;
  const tick = async () => {
    if (running || controller.signal.aborted) return; // never overlap a slow run
    running = true;
    try {
      await job.run(controller.signal);
    } catch (err) {
      console.error(`[worker] ${job.name} failed:`, err);
    } finally {
      running = false;
    }
  };
  void tick();
  timers.push(setInterval(tick, job.everyMs));
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`[worker] ${sig}, stopping`);
    controller.abort();
    timers.forEach(clearInterval);
    void prisma.$disconnect();
  });
}

console.log(`[worker] started ${jobs.length} job(s)`);
