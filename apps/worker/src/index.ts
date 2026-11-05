/**
 * Background worker (plan §8.1): outbox processing, reminder scheduling,
 * later AI and automation jobs. Runs as its own process from the same repo,
 * started with Node 24's type stripping — no build step.
 *
 * Phase 3 fills in the jobs. Until then this is the loop they plug into, so
 * the process, its shutdown handling and its logging exist from day one.
 */

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
  // Phase 3: { name: "outbox", everyMs: 2_000, run: processOutbox },
  // Phase 3: { name: "reminders", everyMs: 15_000, run: scheduleDueReminders },
];

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
  });
}

console.log(`[worker] started ${jobs.length} job(s)`);
