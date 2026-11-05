import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { PrismaService } from "./prisma.module";

/**
 * Creates the DEV_USER_ID user on startup in development, so synced records
 * have an owner before real auth exists (see current-user.ts). Never runs in
 * production. A database that is down is logged, not fatal.
 */
@Injectable()
export class DevUserBootstrap implements OnApplicationBootstrap {
  private readonly log = new Logger("DevUser");

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    const id = process.env.DEV_USER_ID;
    if (process.env.NODE_ENV === "production" || !id) return;
    try {
      await this.prisma.user.upsert({
        where: { id },
        update: {},
        create: { id, email: "dev@localhost", displayName: "Developer" },
      });
      this.log.log(`Development user ${id} ready.`);
    } catch (err) {
      this.log.warn(`Could not create the development user (is Postgres up?): ${String(err)}`);
    }
  }
}
