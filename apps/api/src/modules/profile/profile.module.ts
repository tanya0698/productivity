import { BadRequestException, Body, Controller, Delete, HttpCode, Module, PayloadTooLargeException, Post } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser } from "../../common/current-user";
import { MAX_AVATAR_BYTES, deleteAvatars, saveAvatar, sniffImage } from "./avatar-storage";

const uploadBody = z.object({
  /** A data URL or bare base64 of a PNG, JPEG or WebP; the browser resizes it first. */
  image: z.string().min(16).max(Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 64),
});

/**
 * Profile (Phase 1). Name, phone and the picture's URL live in the Supabase
 * Auth user's metadata, which the client updates itself; this module only
 * stores the picture, since that needs the storage key.
 *
 *   POST   /api/profile/avatar  { image }  →  { url }
 *   DELETE /api/profile/avatar
 */
@Controller("profile")
class ProfileController {
  @Post("avatar")
  async upload(@CurrentUser() userId: string, @Body() body: unknown) {
    const parsed = uploadBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Send the picture as { image: <base64> }.");
    const base64 = parsed.data.image.replace(/^data:[^;]+;base64,/, "");
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length > MAX_AVATAR_BYTES) throw new PayloadTooLargeException("That picture is too big (400 KB at most).");
    // Trust the bytes, not the declared type.
    const type = sniffImage(bytes);
    if (!type) throw new BadRequestException("Use a PNG, JPEG or WebP picture.");
    return { url: await saveAvatar(userId, bytes, type) };
  }

  @Delete("avatar")
  @HttpCode(204)
  async remove(@CurrentUser() userId: string) {
    await deleteAvatars(userId);
  }
}

@Module({ controllers: [ProfileController] })
export class ProfileModule {}
