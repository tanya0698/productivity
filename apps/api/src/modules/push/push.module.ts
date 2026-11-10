import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Module, NotFoundException, Post, ServiceUnavailableException, Headers } from "@nestjs/common";
import webpush from "web-push";
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
 *   POST   /api/push/test            →  { sent }   (a test notification to this user's browsers)
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

  @Post("test")
  async test(@CurrentUser() userId: string) {
    const v = vapid();
    if (!v) throw new ServiceUnavailableException("Push isn't set up on this server.");
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: "Creedence", body: "Notifications are on for this browser.", tag: `test-${Date.now()}`, url: "/reminders" }),
          { vapidDetails: v, TTL: 60 },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }
    return { sent };
  }
}

@Module({ controllers: [PushController] })
export class PushModule {}
