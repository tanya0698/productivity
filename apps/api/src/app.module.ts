import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./common/prisma.module";
import { AuthGuard } from "./common/auth";
import { HealthModule } from "./modules/health/health.module";
import { SyncModule } from "./sync/sync.module";
import { NotesModule } from "./modules/notes/notes.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { RemindersModule } from "./modules/reminders/reminders.module";
import { CalendarModule } from "./modules/calendar/calendar.module";
import { HabitsModule } from "./modules/habits/habits.module";
import { FocusModule } from "./modules/focus/focus.module";
import { GoalsModule } from "./modules/goals/goals.module";
import { ProfileModule } from "./modules/profile/profile.module";

/**
 * One NestJS module per feature key, matching apps/web/src/features/<key> and
 * apps/mobile/src/features/<key> (plan §11.6). Add a module here when its
 * phase starts; copy module-template/api/mymodule.
 *
 * AuthGuard runs on every route; mark open routes with @Public().
 */
@Module({
  imports: [
    PrismaModule,
    HealthModule,
    SyncModule,
    NotesModule,
    TasksModule,
    ProjectsModule,
    RemindersModule,
    CalendarModule,
    HabitsModule,
    FocusModule,
    GoalsModule,
    ProfileModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
