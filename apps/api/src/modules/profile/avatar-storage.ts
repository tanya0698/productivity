/**
 * Profile pictures in Supabase Storage, through the REST API with the secret
 * key (server only). The bucket is public so pictures load from a plain URL;
 * each user writes only under their own id, which comes from their verified
 * token, never from the request.
 */

const BUCKET = "avatars";
export const MAX_AVATAR_BYTES = 400 * 1024;

type ImageType = "image/png" | "image/jpeg" | "image/webp";

/** The image type from its first bytes, or null if it isn't one we accept. */
export function sniffImage(b: Buffer): ImageType | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

const ext: Record<ImageType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set for profile pictures.");
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

let bucketReady: Promise<void> | null = null;

/** Create the public bucket once, if it isn't there yet. */
function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    const { url, headers } = config();
    const res = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers });
    if (res.ok) return;
    const created = await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: BUCKET,
        name: BUCKET,
        public: true,
        file_size_limit: MAX_AVATAR_BYTES,
        allowed_mime_types: Object.keys(ext),
      }),
    });
    if (!created.ok && created.status !== 409) {
      throw new Error(`Couldn't create the avatars bucket: ${created.status} ${await created.text()}`);
    }
  })().catch((err) => {
    bucketReady = null; // try again next time
    throw err;
  });
  return bucketReady;
}

async function listOwn(userId: string): Promise<string[]> {
  const { url, headers } = config();
  const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: userId, limit: 100 }),
  });
  if (!res.ok) return [];
  const items = (await res.json()) as { name: string }[];
  return items.map((i) => `${userId}/${i.name}`);
}

async function removePaths(paths: string[]) {
  if (!paths.length) return;
  const { url, headers } = config();
  await fetch(`${url}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
}

/** Store a new picture for this user, remove their old ones, and return its public URL. */
export async function saveAvatar(userId: string, bytes: Buffer, type: ImageType): Promise<string> {
  await ensureBucket();
  const { url, headers } = config();
  const old = await listOwn(userId);
  // A new name each time, so browsers and CDNs never show a cached old picture.
  const path = `${userId}/${Date.now().toString(36)}.${ext[type]}`;
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": type, "Cache-Control": "max-age=31536000", "x-upsert": "true" },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  await removePaths(old.filter((p) => p !== path));
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function deleteAvatars(userId: string) {
  await ensureBucket();
  await removePaths(await listOwn(userId));
}
