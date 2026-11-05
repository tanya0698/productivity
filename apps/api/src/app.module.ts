import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma.module";
import { DevUserBootstrap } from "./common/dev-user";
import { HealthModule } from "./modules/health/health.module";
import { SyncModule } from "./sync/sync.module";
import { NotesModule } from "./modules/notes/notes.module";
import { TasksModule } from "./modules/tasks/tasks.module";

/**
 * One NestJS module per feature key, matching apps/web/src/features/<key> and
 * apps/mobile/src/features/<key> (plan §11.6). Add a module here when its
 * phase starts; copy module-template/api/mymodule.
 */
@Module({
  imports: [PrismaModule, HealthModule, SyncModule, NotesModule, TasksModule],
  providers: [DevUserBootstrap],
})
export class AppModule {}
