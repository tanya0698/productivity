import type { User } from "@supabase/supabase-js";

/**
 * The profile lives in the Supabase Auth user's metadata (first_name,
 * last_name, full_name for older accounts, phone, avatar_url), the same fields
 * the web app writes at registration and on the Profile card.
 */
type MetaUser = Pick<User, "user_metadata"> | null | undefined;
const meta = (user: MetaUser, key: string): string => {
  const v = user?.user_metadata?.[key];
  return typeof v === "string" ? v.trim() : "";
};

export const firstNameOf = (user: MetaUser) => meta(user, "first_name") || meta(user, "full_name").split(/\s+/)[0] || "";
export const avatarUrlOf = (user: MetaUser) => meta(user, "avatar_url") || null;

/** "Elton Chipuka" from first and last name (or an older full name), or "". */
export const displayName = (user: MetaUser): string =>
  [meta(user, "first_name"), meta(user, "last_name")].filter(Boolean).join(" ") || meta(user, "full_name");

/** Up to two initials: "Elton Chipuka" → "EC", "elton@…" → "E". */
export function initials(text: string): string {
  const words = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? words[0]![0]! + words.at(-1)![0]! : (words[0]?.[0] ?? "?")).toUpperCase();
}

/** "Good morning, Elton." by the hour on this phone; without a name, just "Good morning." */
export function greeting(now: Date, name: string): string {
  const h = now.getHours();
  const part = h < 5 ? "evening" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return `Good ${part}${name ? `, ${name}` : ""}.`;
}
