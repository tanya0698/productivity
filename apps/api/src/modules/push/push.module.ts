import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Module, NotFoundException, Post, Headers } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser } from "../../common/current-user";
import { PrismaService } from "../../common/prisma.module";

/**
 * Web push (plan §8.1). Browsers subscribe here; the worker sends due
 * reminders to them. Keys come from VAPID_* in the root .env.
 *
 *   GET    /api/push/key             →  { publicKey }
 *   POST   /api/push/subscriptions   { endpoint, keys: { p256dh, auth } }
 *   DELETE /api/push/subscriptions   { endpoint }
 *
 * And the Android app registers here for reminders pushed by the worker through
 * Firebase Cloud Messaging (FIREBASE_SERVICE_ACCOUNT_FILE):
 *
 *   POST   /api/push/devices         { token, platform }   (after sign-in, and when FCM renews the token)
 *   DELETE /api/push/devices         { token }             (on sign-out)
 */

/**
 * Only real push services. The server POSTs to whatever endpoint is stored, so
 * an arbitrary URL here would let anyone make it call into other systems.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/];

export function isPushEndpoint(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password && PUSH_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}

const base64url = z.string().regex(/^[A-Za-z0-9_-]+=*$/).max(200);
const subscribeBody = z.object({
  endpoint: z.string().max(2000).refine(isPushEndpoint, "Not a push service endpoint."),
  keys: z.object({ p256dh: base64url, auth: base64url }),
});
const unsubscribeBody = z.object({ endpoint: z.string().max(2000) });
/** FCM registration tokens are long opaque strings; no URLs, no spaces. */
const fcmToken = z.string().min(20).max(4096).regex(/^[A-Za-z0-9:_\-.]+$/);
const deviceBody = z.object({ token: fcmToken, platform: z.enum(["android"]) });
const deviceTokenBody = z.object({ token: fcmToken });

function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:notifications@example.com" };
}

@Controller("push")
class PushController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("key")
  key() {
    const v = vapid();
    if (!v) throw new NotFoundException("Push isn't set up on this server.");
    return { publicKey: v.publicKey };
  }

  @Post("subscriptions")
  @HttpCode(204)
  async subscribe(@CurrentUser() userId: string, @Body() body: unknown, @Headers("user-agent") userAgent?: string) {
    const parsed = subscribeBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Send { endpoint, keys }.");
    const { endpoint, keys } = parsed.data;
    // One browser, one row: signing in as someone else on it moves the subscription over.
    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 300) ?? null },
      update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 300) ?? null },
    });
  }

  @Delete("subscriptions")
  @HttpCode(204)
  async unsubscribe(@CurrentUser() userId: string, @Body() body: unknown) {
    const parsed = unsubscribeBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Send { endpoint }.");
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint: parsed.data.endpoint } });
  }
}

@Controller("push/devices")
class DevicePushController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(204)
  async register(@CurrentUser() userId: string, @Body() body: unknown) {
    const parsed = deviceBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Send { token, platform: \"android\" }.");
    const { token, platform } = parsed.data;
    // One phone, one row: signing in as someone else on it moves the token over.
    await this.prisma.devicePushToken.upsert({ where: { token }, create: { userId, token, platform }, update: { userId, platform } });
  }

  @Delete()
  @HttpCode(204)
  async unregister(@CurrentUser() userId: string, @Body() body: unknown) {
    const parsed = deviceTokenBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Send { token }.");
    await this.prisma.devicePushToken.deleteMany({ where: { userId, token: parsed.data.token } });
  }
}

@Module({ controllers: [PushController, DevicePushController] })
export class PushModule {}
