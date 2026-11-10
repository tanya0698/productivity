/**
 * Profile pictures: shrink in the browser, upload through the API (which
 * holds the storage key), and keep one chosen at registration until the
 * account exists.
 */

const SIZE = 320;
/** The API takes 400 KB; stay well under it. */
const MAX_BYTES = 360 * 1024;
const PENDING_KEY = (email: string) => `creedence:pending-avatar:${email.trim().toLowerCase()}`;

const approxBytes = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

/**
 * A square, centre-cropped 320 px picture as a data URL: WebP where the
 * browser can make it, else JPEG. Rejects files that aren't images.
 */
export async function prepareAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a picture (PNG, JPEG, WebP, HEIC…).");
  if (file.size > 20 * 1024 * 1024) throw new Error("That picture is over 20 MB. Choose a smaller one.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This browser can't read that picture. Try a JPEG or PNG.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  for (const [type, quality] of [
    ["image/webp", 0.86],
    ["image/jpeg", 0.86],
    ["image/jpeg", 0.7],
  ] as const) {
    const url = canvas.toDataURL(type, quality);
    // A browser that can't encode the type quietly returns PNG; only keep what we asked for.
    if (url.startsWith(`data:${type}`) && approxBytes(url) <= MAX_BYTES) return url;
  }
  throw new Error("Couldn't make that picture small enough. Try another one.");
}

/** Upload a prepared picture; returns its public URL. */
export async function uploadAvatar(dataUrl: string, token: string | null): Promise<string> {
  const res = await fetch("/api/profile/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ image: dataUrl }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Upload failed (${res.status}).`);
  }
  return ((await res.json()) as { url: string }).url;
}

export async function removeAvatar(token: string | null): Promise<void> {
  const res = await fetch("/api/profile/avatar", { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok && res.status !== 204) throw new Error(`Couldn't remove the picture (${res.status}).`);
}

/** Keep a picture chosen at registration, for after the email is confirmed and they sign in. */
export function setPendingAvatar(email: string, dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(PENDING_KEY(email), dataUrl);
    else localStorage.removeItem(PENDING_KEY(email));
  } catch {
    /* storage blocked: they can add it from Profile later */
  }
}

export function takePendingAvatar(email: string): string | null {
  try {
    return localStorage.getItem(PENDING_KEY(email));
  } catch {
    return null;
  }
}
