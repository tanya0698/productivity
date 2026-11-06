/**
 * End-to-end auth check against the real Supabase project and the running API.
 *
 *   npm run dev:api        (in another terminal)
 *   npm run auth:check
 *
 * Needs, in the root .env:            SUPABASE_URL, SUPABASE_SECRET_KEY (server only)
 * and, in apps/web/.env.local:        VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * The secret key is used only to create and reset the two demo accounts and to
 * mint a password-reset link without a real inbox (Supabase's built-in mailer
 * only delivers to the project team). Every sign-in, password change and
 * two-step check goes through the public key, exactly as the apps do.
 *
 * Creates (or refreshes) two demo accounts and leaves them in place; their
 * logins are written to demo-accounts.local (git-ignored). Removes every note
 * it creates.
 */
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const root = resolve(import.meta.dirname, "..");
process.loadEnvFile(join(root, ".env"));
const webEnv = Object.fromEntries(
  readFileSync(join(root, "apps", "web", ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const URL_ = process.env.SUPABASE_URL ?? "";
const SECRET = process.env.SUPABASE_SECRET_KEY ?? "";
const PUBLISHABLE = webEnv.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const API = process.env.API_URL ?? "http://localhost:3000/api";

const missing = [
  !URL_ && "SUPABASE_URL (root .env)",
  (!SECRET || !/^(sb_secret_|eyJ)/.test(SECRET)) && "SUPABASE_SECRET_KEY (root .env)",
  (!PUBLISHABLE || PUBLISHABLE.startsWith("PASTE")) && "VITE_SUPABASE_PUBLISHABLE_KEY (apps/web/.env.local)",
].filter(Boolean);
if (missing.length) {
  console.log(`Missing: ${missing.join(", ")}`);
  process.exit(2);
}

let failed = 0;
const notes: string[] = [];
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}
const info = (line: string) => {
  console.log(`NOTE  ${line}`);
  notes.push(line);
};

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(URL_, SECRET, opts);
/** A fresh client per "device", like a new browser. */
const device = () => createClient(URL_, PUBLISHABLE, opts);

// ─── TOTP (RFC 6238), so the two-step check needs no phone ──────────────────
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of input.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  const n = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(n % 1_000_000).padStart(6, "0");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const strongPassword = () => `Demo-${randomBytes(9).toString("base64url")}!7`;

async function findUser(email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Create the demo account, or reset it to a known state if it exists from an earlier run. */
async function ensureDemo(email: string, password: string) {
  const existing = await findUser(email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (error) throw error;
    const { data } = await admin.auth.admin.mfa.listFactors({ userId: existing.id });
    for (const f of data?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ userId: existing.id, id: f.id });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return data.user.id;
}

async function signIn(client: SupabaseClient, email: string, password: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  return { session: data.session, error };
}

async function api(path: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const res = await fetch(API + path, { ...init, headers });
  return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}

async function pushNote(token: string, id: string, text: string) {
  return api("/sync/push", token, {
    method: "POST",
    body: JSON.stringify({
      operations: [
        {
          operationId: randomUUID(),
          entityType: "note",
          entityId: id,
          op: "upsert",
          baseVersion: null,
          payload: { projectId: null, folderId: null, title: "", body: { type: "plain", text }, bodyText: text, pinned: false, archivedAt: null },
          deviceId: randomUUID(),
          clientTimestamp: new Date().toISOString(),
        },
      ],
    }),
  });
}

const pulledIds = async (token: string) => {
  const r = await api("/sync/pull?cursor=0", token);
  return { status: r.status, ids: ((r.body?.changes as { entityId: string }[] | undefined) ?? []).map((c) => c.entityId) };
};

// ─── The checks ──────────────────────────────────────────────────────────────
const demo1 = { email: "demo1.productivity@example.com", password: strongPassword() };
const demo2 = { email: "demo2.productivity@example.com", password: strongPassword() };
const createdNotes: string[] = [];
let demo2Secret = "";

try {
  const health = await api("/health", null);
  check("API is running", health.status === 200, `${API}`);

  // Register ────────────────────────────────────────────────────────────────
  const throwaway = `signup-check-${Date.now()}@example.com`;
  const reg = await device().auth.signUp({ email: throwaway, password: strongPassword() });
  if (reg.error) {
    info(`Public registration of a new address returned: "${reg.error.message}" (status ${reg.error.status}).`);
    check("registration answers with a clear outcome", !!reg.error.message);
  } else {
    check(
      "registration creates the account",
      !!reg.data.user,
      reg.data.session ? "signed in straight away (email confirmation is off)" : "awaiting email confirmation",
    );
  }
  const stray = await findUser(throwaway);
  if (stray) await admin.auth.admin.deleteUser(stray.id);

  const id1 = await ensureDemo(demo1.email, demo1.password);
  const id2 = await ensureDemo(demo2.email, demo2.password);
  check("two demo accounts exist and are confirmed", !!id1 && !!id2);

  // Login ───────────────────────────────────────────────────────────────────
  const d1 = device();
  const login1 = await signIn(d1, demo1.email, demo1.password);
  check("login with the right password", !!login1.session, login1.error?.message ?? "");
  const wrong = await signIn(device(), demo1.email, "not-the-password");
  check("login with a wrong password is refused", !wrong.session && !!wrong.error, wrong.error?.message ?? "");

  const token1 = login1.session!.access_token;
  const pull1 = await api("/sync/pull?cursor=0", token1);
  check("API accepts a real Supabase token", pull1.status === 200, String(pull1.status));
  const noToken = await api("/sync/pull?cursor=0", null);
  info(`API without a token returned ${noToken.status} (200 only while ALLOW_DEV_USER=true in development).`);

  // Isolation between accounts ───────────────────────────────────────────────
  const d2 = device();
  const login2 = await signIn(d2, demo2.email, demo2.password);
  const token2 = login2.session!.access_token;
  const noteId = randomUUID();
  createdNotes.push(noteId);
  const pushed = await pushNote(token1, noteId, "demo1's private note");
  check("demo1 saves a note through the API", pushed.status === 201 || pushed.status === 200, String(pushed.status));
  check("demo1 sees their note", (await pulledIds(token1)).ids.includes(noteId));
  check("demo2 cannot see demo1's note", !(await pulledIds(token2)).ids.includes(noteId));
  const hijack = await api("/sync/push", token2, {
    method: "POST",
    body: JSON.stringify({
      operations: [
        {
          operationId: randomUUID(),
          entityType: "note",
          entityId: noteId,
          op: "upsert",
          baseVersion: 1,
          payload: { projectId: null, folderId: null, title: "taken over", body: {}, bodyText: "", pinned: false, archivedAt: null },
          deviceId: randomUUID(),
          clientTimestamp: new Date().toISOString(),
        },
      ],
    }),
  });
  const hijackResult = (hijack.body?.results as { status: string }[] | undefined)?.[0]?.status;
  check("demo2 cannot overwrite demo1's note", hijackResult === "rejected", hijackResult ?? String(hijack.status));

  // Update password while signed in ─────────────────────────────────────────
  const changed = strongPassword();
  const upd = await d1.auth.updateUser({ password: changed });
  check("update password while signed in", !upd.error, upd.error?.message ?? "");
  check("the new password works", !!(await signIn(device(), demo1.email, changed)).session);
  check("the old password no longer works", !(await signIn(device(), demo1.email, demo1.password)).session);
  demo1.password = changed;

  // Forgot password → reset link → new password ─────────────────────────────
  const forgot = await device().auth.resetPasswordForEmail(demo1.email, { redirectTo: "http://localhost:5173" });
  if (forgot.error) info(`"Forgot password" email for a demo address: "${forgot.error.message}". Real team addresses receive it.`);
  else check("forgot password: reset email requested", true);

  const link = await admin.auth.admin.generateLink({ type: "recovery", email: demo1.email });
  check("a reset link can be issued", !!link.data.properties?.hashed_token, link.error?.message ?? "");
  const resetDevice = device();
  const recovered = await resetDevice.auth.verifyOtp({ token_hash: link.data.properties!.hashed_token, type: "recovery" });
  check("opening the reset link signs in for recovery", !!recovered.data.session, recovered.error?.message ?? "");
  const afterReset = strongPassword();
  const setNew = await resetDevice.auth.updateUser({ password: afterReset });
  check("reset: choosing a new password", !setNew.error, setNew.error?.message ?? "");
  check("reset: signing in with the new password", !!(await signIn(device(), demo1.email, afterReset)).session);
  check("reset: the previous password is dead", !(await signIn(device(), demo1.email, demo1.password)).session);
  demo1.password = afterReset;
  const reused = await resetDevice.auth.verifyOtp({ token_hash: link.data.properties!.hashed_token, type: "recovery" });
  check("a reset link works only once", !reused.data.session, reused.error?.message ?? "");

  // Two-step verification (demo2) ───────────────────────────────────────────
  const enroll = await d2.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
  check("2FA: enrolment returns a QR code and key", !!enroll.data?.totp.secret, enroll.error?.message ?? "");
  demo2Secret = enroll.data!.totp.secret;
  const badCode = await d2.auth.mfa.challengeAndVerify({ factorId: enroll.data!.id, code: "000000" });
  check("2FA: a wrong code is refused", !!badCode.error);
  const verify = await d2.auth.mfa.challengeAndVerify({ factorId: enroll.data!.id, code: totp(demo2Secret) });
  check("2FA: the right code turns it on", !verify.error, verify.error?.message ?? "");

  const d2b = device();
  const pwOnly = await signIn(d2b, demo2.email, demo2.password);
  const level = await d2b.auth.mfa.getAuthenticatorAssuranceLevel();
  check(
    "2FA: a password-only sign-in still owes a code",
    level.data?.currentLevel === "aal1" && level.data.nextLevel === "aal2",
    `${level.data?.currentLevel} → ${level.data?.nextLevel}`,
  );
  const blocked = await api("/sync/pull?cursor=0", pwOnly.session!.access_token);
  check("2FA: the API refuses a session that skipped the code", blocked.status === 401, String(blocked.status));
  const factors = await d2b.auth.mfa.listFactors();
  const step2 = await d2b.auth.mfa.challengeAndVerify({ factorId: factors.data!.totp[0]!.id, code: totp(demo2Secret) });
  check("2FA: entering the code completes sign-in", !step2.error, step2.error?.message ?? "");
  const aal2Token = (await d2b.auth.getSession()).data.session!.access_token;
  const allowed = await api("/sync/pull?cursor=0", aal2Token);
  check("2FA: the API accepts the verified session", allowed.status === 200, String(allowed.status));

  // Sign out ────────────────────────────────────────────────────────────────
  const refreshToken = login1.session!.refresh_token;
  await d1.auth.signOut();
  const reuse = await device().auth.refreshSession({ refresh_token: refreshToken });
  check("sign out: the old session can't be refreshed", !reuse.data.session, reuse.error?.message ?? "");
} catch (err) {
  failed++;
  console.log("ERROR", err instanceof Error ? err.message : String(err));
} finally {
  if (createdNotes.length) {
    const req = createRequire(join(root, "apps", "api", "package.json"));
    const { PrismaClient } = req("@prisma/client");
    const prisma = new PrismaClient();
    const a = await prisma.syncChange.deleteMany({ where: { entityId: { in: createdNotes } } });
    const b = await prisma.note.deleteMany({ where: { id: { in: createdNotes } } });
    console.log(`cleanup: removed ${a.count} log rows, ${b.count} notes`);
    await prisma.$disconnect();
  }
}

writeFileSync(
  join(root, "demo-accounts.local"),
  [
    "# Demo accounts created by `npm run auth:check`. Git-ignored. Rerunning resets both passwords.",
    "",
    `demo1 (password only)`,
    `  email:    ${demo1.email}`,
    `  password: ${demo1.password}`,
    "",
    `demo2 (two-step verification on)`,
    `  email:    ${demo2.email}`,
    `  password: ${demo2.password}`,
    demo2Secret ? `  2FA key:  ${demo2Secret}   (add it to an authenticator app as "Productivity demo2")` : "  2FA key:  (not set up)",
    demo2Secret ? `  2FA URI:  otpauth://totp/Productivity:${demo2.email}?secret=${demo2Secret}&issuer=Productivity` : "",
    "",
  ].join("\n"),
);
console.log("logins saved to demo-accounts.local");
console.log(failed ? `RESULT: ${failed} failed` : "RESULT: all passed");
process.exit(failed ? 1 : 0);
