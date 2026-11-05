import "reflect-metadata";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

// The repo-root .env (copied from .env.example). Node 24 reads it natively;
// a missing file is fine — real deployments set the variables directly.
try {
  process.loadEnvFile(resolve(__dirname, "../../../.env"));
} catch {
  /* no .env */
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Every route is under /api, matching the web app's `/api/<key>` convention
  // and the single dev proxy in apps/web/vite.config.ts.
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api`);
}

void bootstrap();
