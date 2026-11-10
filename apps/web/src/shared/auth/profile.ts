import type { User } from "@supabase/supabase-js";

/**
 * The profile lives in the Supabase Auth user's metadata: first_name,
 * last_name, full_name (kept for older accounts and other apps), phone and
 * avatar_url. Set at registration and on the Profile card.
 */
type MetaUser = Pick<User, "user_metadata"> | null | undefined;
const meta = (user: MetaUser, key: string): string => {
  const v = user?.user_metadata?.[key];
  return typeof v === "string" ? v.trim() : "";
};

export const firstNameOf = (user: MetaUser) => meta(user, "first_name") || meta(user, "full_name").split(/\s+/)[0] || "";
export const lastNameOf = (user: MetaUser) => meta(user, "last_name") || meta(user, "full_name").split(/\s+/).slice(1).join(" ");
export const phoneOf = (user: MetaUser) => meta(user, "phone");
export const avatarUrlOf = (user: MetaUser) => meta(user, "avatar_url") || null;

/** "Elton Chipuka", from first and last name (or an older full name), or "". */
export const displayName = (user: MetaUser): string =>
  [meta(user, "first_name"), meta(user, "last_name")].filter(Boolean).join(" ") || meta(user, "full_name");

/** The person's first name, for greetings. */
export const firstName = (user: MetaUser) => firstNameOf(user);

/** Up to two initials for an avatar: "Elton Chipuka" → "EC", "elton@…" → "E". */
export function initials(text: string): string {
  const words = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? words[0]![0]! + words.at(-1)![0]! : (words[0]?.[0] ?? "?")).toUpperCase();
}

/** The metadata to save for a profile; full_name too, so anything reading it still works. */
export function profileMetadata(p: { firstName: string; lastName: string; phone?: string | null }) {
  const first = p.firstName.trim();
  const last = p.lastName.trim();
  return { first_name: first, last_name: last, full_name: [first, last].filter(Boolean).join(" "), phone: p.phone?.trim() || null };
}

/** A phone number people actually type: digits with optional +, spaces, dashes, dots and brackets. */
export const PHONE_PATTERN = /^\+?[\d\s().-]{7,20}$/;
