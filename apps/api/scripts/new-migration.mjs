#!/usr/bin/env node
/**
 * Create a new migration from the difference between the live database and
 * prisma/schema.prisma, without the shadow database `prisma migrate dev`
 * needs (awkward on Supabase).
 *
 *   npm run prisma:new-migration -w @productivity/api -- add_reminders
 *
 * Review the generated SQL, then apply it with `npm run prisma:deploy`.
 * Reads DIRECT_URL from the repo-root .env.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const name = process.argv[2];
if (!name || !/^[a-z0-9_]+$/.test(name)) {
  console.error("Usage: npm run prisma:new-migration -w @productivity/api -- <snake_case_name>");
  process.exit(1);
}

const api = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(api, "..", "..");
try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  /* variables may already be set */
}
if (!process.env.DIRECT_URL) {
  console.error("DIRECT_URL is not set. Copy .env.example to .env and fill in your Supabase connection strings.");
  process.exit(1);
}

let sql = execFileSync(
  process.execPath,
  [
    join(root, "node_modules", "prisma", "build", "index.js"),
    "migrate", "diff",
    "--from-url", process.env.DIRECT_URL,
    "--to-schema-datamodel", join(api, "prisma", "schema.prisma"),
    "--script",
  ],
  { encoding: "utf8", env: process.env },
);

/*
  Objects added by hand in migrations (Prisma can't declare them). The diff
  sees them in the database but not in schema.prisma and would drop them, so
  those statements are removed here. Add to this list when you hand-add more.
*/
const handManaged = [/"search_vector"/, /"notes_search_idx"/];
const kept = [];
for (const stmt of sql.split(/(?<=;)\s*\n/)) {
  if (handManaged.some((re) => re.test(stmt)) && /\bDROP\b/i.test(stmt)) {
    console.warn(`Skipped (hand-managed object): ${stmt.trim().split("\n").pop()}`);
    continue;
  }
  kept.push(stmt);
}
sql = kept.join("\n");

if (!sql.trim() || /This is an empty migration/.test(sql)) {
  console.log("No changes between the database and schema.prisma.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const dir = join(api, "prisma", "migrations", `${stamp}_${name}`);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "migration.sql"), sql);
console.log(`Wrote ${dir}/migration.sql — review it, then run: npm run prisma:deploy -w @productivity/api`);
