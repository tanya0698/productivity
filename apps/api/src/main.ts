import "reflect-metadata";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

// The repo-root .env (copied from .env.example). Node 24 reads it natively;
// a missing file is fine — real deployments set the variables directly.
try {
  process.loadEnvFile(resolve(__dirname, "../../../.env"));
} catch {
  /* no .env */
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Room for a resized profile picture (base64); sync batches are far smaller.
  app.useBodyParser("json", { limit: "1mb" });
  // Every route is under /api, matching the web app's `/api/<key>` convention
  // and the single dev proxy in apps/web/vite.config.ts.
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api`);

  // Free hosting has no separate worker process: with RUN_WORKER=true the
  // worker's jobs (push for due reminders) run inside this process instead.
  // Loading the worker's entry file starts them, exactly as `npm run start -w
  // @productivity/worker` does; Node 24 runs its TypeScript directly. Leave
  // it unset wherever the worker runs on its own (locally, or a paid host).
  if (process.env.RUN_WORKER === "true") {
    await import(pathToFileURL(resolve(__dirname, "../../worker/src/index.ts")).href);
  }
}

void bootstrap();
