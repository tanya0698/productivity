import { Module } from "@nestjs/common";

/**
 * Projects (plan §11.6). Synced through /api/sync via
 * `projects.sync-handler.ts`. Tasks and notes point at a project with
 * `projectId`; their handlers keep that link only to the user's own projects.
 */
@Module({})
export class ProjectsModule {}
