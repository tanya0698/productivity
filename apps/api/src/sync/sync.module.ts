import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  Post,
  Query,
} from "@nestjs/common";
import { pushRequest } from "@productivity/contracts";
import { CurrentUser } from "../common/current-user";
import { notesSyncHandler } from "../modules/notes/notes.sync-handler";
import { projectsSyncHandler } from "../modules/projects/projects.sync-handler";
import { remindersSyncHandler } from "../modules/reminders/reminders.sync-handler";
import { eventExceptionsSyncHandler, eventsSyncHandler } from "../modules/calendar/calendar.sync-handlers";
import { tasksSyncHandler } from "../modules/tasks/tasks.sync-handler";
import { habitLogsSyncHandler, habitsSyncHandler } from "../modules/habits/habits.sync-handlers";
import { focusSessionsSyncHandler } from "../modules/focus/focus.sync-handler";
import { goalMilestonesSyncHandler, goalsSyncHandler } from "../modules/goals/goals.sync-handlers";
import { SYNC_HANDLERS } from "./sync-handler";
import { SyncService } from "./sync.service";

@Controller("sync")
class SyncController {
  constructor(private readonly sync: SyncService) {}

  /** `POST /api/sync/push` */
  @Post("push")
  push(@CurrentUser() userId: string, @Body() body: unknown) {
    const parsed = pushRequest.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.sync.push(userId, parsed.data);
  }

  /** `GET /api/sync/pull?cursor=<changeSeq>` */
  @Get("pull")
  pull(@CurrentUser() userId: string, @Query("cursor") cursor?: string) {
    const n = Number(cursor ?? 0);
    if (!Number.isSafeInteger(n) || n < 0) throw new BadRequestException("cursor must be a non-negative integer");
    return this.sync.pull(userId, n);
  }
}

/**
 * Register each module's handler here as modules are added. (A discovery
 * mechanism can replace this list once there are more than a handful.)
 */
@Module({
  controllers: [SyncController],
  providers: [
    SyncService,
    {
      provide: SYNC_HANDLERS,
      useValue: [
        projectsSyncHandler,
        notesSyncHandler,
        tasksSyncHandler,
        remindersSyncHandler,
        eventsSyncHandler,
        eventExceptionsSyncHandler,
        habitsSyncHandler,
        habitLogsSyncHandler,
        focusSessionsSyncHandler,
        goalsSyncHandler,
        goalMilestonesSyncHandler,
      ],
    },
  ],
})
export class SyncModule {}
