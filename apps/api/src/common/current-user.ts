import {
  createParamDecorator,
  ForbiddenException,
  type ExecutionContext,
} from "@nestjs/common";

/**
 * The signed-in user's id.
 *
 * TEMPORARY: auth is an open decision (ADR 0003 — Supabase Auth is the leading
 * option). Until it is made, development runs as a single
 * user from DEV_USER_ID, and this refuses outright in production so the stub
 * can never ship by accident. Replace the body once the ADR is decided; every
 * controller already reads the user through this one decorator.
 */
export const CurrentUser = createParamDecorator((_: unknown, _ctx: ExecutionContext): string => {
  if (process.env.NODE_ENV === "production") {
    throw new ForbiddenException("Authentication is not configured.");
  }
  const id = process.env.DEV_USER_ID;
  if (!id) throw new ForbiddenException("Set DEV_USER_ID in .env for local development.");
  return id;
});
