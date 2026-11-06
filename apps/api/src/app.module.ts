import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./common/prisma.module";
import { AuthGuard } from "./common/auth";
import { HealthModule } from "./modules/health/health.module";
import { SyncModule } from "./sync/sync.module";
import { NotesModule } from "./modules/notes/notes.module";
import { TasksModule } from "./modules/tasks/tasks.module";

/**
 * One NestJS module per feature key, matching apps/web/src/features/<key> and
 * apps/mobile/src/features/<key> (plan §11.6). Add a module here when its
 * phase starts; copy module-template/api/mymodule.
 *
 * AuthGuard runs on every route; mark open routes with @Public().
 */
@Module({
  imports: [PrismaModule, HealthModule, SyncModule, NotesModule, TasksModule],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
