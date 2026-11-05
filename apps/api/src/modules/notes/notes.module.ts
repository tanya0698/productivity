import { Module } from "@nestjs/common";

/**
 * Notes (plan §11.6). Synced records go through /api/sync via
 * `notes.sync-handler.ts`; add HTTP routes under /api/notes only for things
 * sync can't do (server-side full-text search across devices, exports).
 *
 *   domain/ · application/ · infrastructure/ · presentation/
 * get added as the module grows — none are needed for sync alone.
 */
@Module({})
export class NotesModule {}
