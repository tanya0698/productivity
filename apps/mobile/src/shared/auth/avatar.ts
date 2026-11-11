import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "../data/openRuntime";

/**
 * Profile pictures on the phone: pick (library or camera) with a square crop,
 * shrink to 320 px JPEG, and upload through the API, which holds the storage
 * key. The same endpoint and size limits as the web.
 */

const SIZE = 320;
/** The API takes 400 KB; stay well under it. */
const MAX_BYTES = 360 * 1024;

export type AvatarSource = "library" | "camera";

/** A picked picture: a data URL to upload, and its local file to show or keep. */
export interface PickedAvatar {
  dataUrl: string;
  uri: string;
}

/** Shrink a local picture to a square 320 px JPEG data URL. */
async function shrink(uri: string, width?: number, height?: number): Promise<PickedAvatar> {
  const ctx = ImageManipulator.manipulate(uri);
  if (width && height && width !== height) {
    const side = Math.min(width, height);
    ctx.crop({ originX: (width - side) / 2, originY: (height - side) / 2, width: side, height: side });
  }
  ctx.resize({ width: SIZE, height: SIZE });
  const image = await ctx.renderAsync();
  for (const compress of [0.86, 0.7, 0.5]) {
    const out = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    if (out.base64 && (out.base64.length * 3) / 4 <= MAX_BYTES) return { dataUrl: `data:image/jpeg;base64,${out.base64}`, uri: out.uri };
  }
  throw new Error("Couldn't make that picture small enough. Try another one.");
}

/** Let the person choose or take a picture, cropped square. Null if they cancel. */
export async function pickAvatar(source: AvatarSource): Promise<PickedAvatar | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Allow camera access in Settings to take a picture.");
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  return shrink(a.uri, a.width, a.height);
}

/** Upload a prepared picture; returns its public URL. */
export async function uploadAvatar(dataUrl: string, token: string | null): Promise<string> {
  const res = await fetch(`${API_URL}/profile/avatar`, {
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
  const res = await fetch(`${API_URL}/profile/avatar`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok && res.status !== 204) throw new Error(`Couldn't remove the picture (${res.status}).`);
}

// A picture chosen at registration waits until the email is confirmed and the
// person signs in. Only its local file path is kept (secure storage is small);
// if the phone has cleared it by then, they can add one from Account.
const pendingKey = (email: string) => `creedence.pending-avatar.${email.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_")}`;

export async function setPendingAvatar(email: string, uri: string | null) {
  try {
    if (uri) await SecureStore.setItemAsync(pendingKey(email), uri);
    else await SecureStore.deleteItemAsync(pendingKey(email));
  } catch {
    /* they can add it from Account later */
  }
}

/** The pending picture, re-read from its file as a data URL; null if none or gone. */
export async function takePendingAvatar(email: string): Promise<string | null> {
  try {
    const uri = await SecureStore.getItemAsync(pendingKey(email));
    if (!uri) return null;
    return (await shrink(uri)).dataUrl;
  } catch {
    await setPendingAvatar(email, null);
    return null;
  }
}
