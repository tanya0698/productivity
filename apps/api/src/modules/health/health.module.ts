import { Controller, Get, Module } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.module";
import { Public } from "../../common/auth";

@Controller("health")
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** `GET /api/health` — up, plus whether the database answers. Open to anyone. */
  @Public()
  @Get()
  async check() {
    let database: "up" | "down" = "up";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "down";
    }
    return { status: "ok", database, time: new Date().toISOString() };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
