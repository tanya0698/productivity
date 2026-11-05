/**
 * Copy this folder to apps/api/src/modules/<key>/, replace `mymodule` /
 * `MyModule`, then:
 *   1. add the module to `imports` in src/app.module.ts
 *   2. add its sync handler to SYNC_HANDLERS in src/sync/sync.module.ts
 *   3. add its entity to `entityType` in packages/contracts and its table to
 *      prisma/schema.prisma (then `npm run prisma:migrate -w @productivity/api`)
 *
 * Routes go under /api/mymodule/... and only for what sync can't do.
 */
import { Controller, Get, Module } from "@nestjs/common";
import { CurrentUser } from "../../common/current-user";

@Controller("mymodule")
class MyModuleController {
  /** `GET /api/mymodule/ping` — delete once the module has real routes. */
  @Get("ping")
  ping(@CurrentUser() userId: string) {
    return { module: "mymodule", userId };
  }
}

@Module({ controllers: [MyModuleController] })
export class MyModuleModule {}
