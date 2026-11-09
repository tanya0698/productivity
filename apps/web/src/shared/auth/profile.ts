import type { User } from "@supabase/supabase-js";

/** The name the person gave in their profile, or "" if none. */
export const displayName = (user: Pick<User, "user_metadata"> | null | undefined): string => {
  const n = user?.user_metadata?.full_name;
  return typeof n === "string" ? n.trim() : "";
};

/** Up to two initials for an avatar: "Elton Chipuka" → "EC", "elton@…" → "E". */
export function initials(text: string): string {
  const words = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? words[0]![0]! + words.at(-1)![0]! : (words[0]?.[0] ?? "?")).toUpperCase();
}

/** The person's first name, for greetings. */
export const firstName = (user: Pick<User, "user_metadata"> | null | undefined) => displayName(user).split(/\s+/)[0] ?? "";
