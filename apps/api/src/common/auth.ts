import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { PrismaService } from "./prisma.module";

/**
 * Authentication with Supabase Auth (ADR 0003).
 *
 * Clients sign in with supabase-js and send the access token as
 * `Authorization: Bearer <token>`. The project signs tokens with an asymmetric
 * key (ES256), so the API verifies them against the project's public JWKS:
 * no shared secret lives on the server.
 *
 * Every route needs a valid token unless marked @Public(). For local scripts
 * only, ALLOW_DEV_USER=true lets a request *without* a token act as
 * DEV_USER_ID. It never applies when a token is sent (a bad token is always a
 * 401) and never in production.
 */

export interface AuthUser {
  id: string;
  email: string | null;
}

const IS_PUBLIC = "auth:isPublic";
/** Open a route to unauthenticated callers, e.g. the health check. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** The signed-in user's id, set by AuthGuard. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const user = ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user;
  if (!user) throw new UnauthorizedException("Sign in to continue.");
  return user.id;
});

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly log = new Logger("Auth");
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null;
  private readonly issuer: string | null;
  /** Users already ensured in the database during this process's life. */
  private readonly known = new Set<string>();

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
    this.issuer = url ? `${url}/auth/v1` : null;
    this.jwks = url ? createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`)) : null;
    if (!url) this.log.warn("SUPABASE_URL is not set: every authenticated request will be refused.");
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();
    const header = req.headers.authorization;

    if (header?.startsWith("Bearer ")) {
      const { user, aal } = await this.verify(header.slice("Bearer ".length));
      // A password alone isn't enough for an account with two-step verification on.
      if (aal !== "aal2" && (await this.hasSecondFactor(user.id))) {
        throw new UnauthorizedException("Two-step verification required. Enter the code from your authenticator app.");
      }
      req.user = user;
    } else if (this.devUserAllowed()) {
      req.user = { id: process.env.DEV_USER_ID!, email: null };
    } else {
      throw new UnauthorizedException("Sign in to continue.");
    }

    await this.ensureUser(req.user);
    return true;
  }

  private devUserAllowed(): boolean {
    return (
      process.env.ALLOW_DEV_USER === "true" && process.env.NODE_ENV !== "production" && !!process.env.DEV_USER_ID
    );
  }

  private async verify(token: string): Promise<{ user: AuthUser; aal: string | null }> {
    if (!this.jwks || !this.issuer) throw new UnauthorizedException("Authentication is not configured.");
    let payload: JWTPayload & { email?: string; aal?: string };
    try {
      ({ payload } = await jwtVerify(token, this.jwks, { issuer: this.issuer, audience: "authenticated" }));
    } catch {
      throw new UnauthorizedException("Your session has expired. Sign in again.");
    }
    if (!payload.sub) throw new UnauthorizedException("Invalid session.");
    return {
      user: { id: payload.sub, email: typeof payload.email === "string" ? payload.email : null },
      aal: typeof payload.aal === "string" ? payload.aal : null,
    };
  }

  /**
   * Whether the account has a verified second factor, read from Supabase Auth's
   * own table in the same database.
   *
   * Only a "yes" is cached. Caching a "no" once let password-only sessions
   * through for up to 30 seconds after two-step verification was turned on
   * (caught by `npm run auth:check`). A cached "yes" errs the safe way: after
   * turning it off, a password-only session waits at most 30 seconds.
   */
  private readonly hasFactorUntil = new Map<string, number>();

  private async hasSecondFactor(userId: string): Promise<boolean> {
    if ((this.hasFactorUntil.get(userId) ?? 0) > Date.now()) return true;
    const rows = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM auth.mfa_factors WHERE user_id = ${userId}::uuid AND status = 'verified'`;
    const has = (rows[0]?.n ?? 0) > 0;
    if (has) this.hasFactorUntil.set(userId, Date.now() + 30_000);
    else this.hasFactorUntil.delete(userId);
    return has;
  }

  /** The user row records' foreign keys point at; created on first sight. */
  private async ensureUser(user: AuthUser) {
    if (this.known.has(user.id)) return;
    const email = user.email ?? `${user.id}@users.local`;
    await this.prisma.user.upsert({
      where: { id: user.id },
      update: user.email ? { email } : {},
      create: { id: user.id, email, displayName: email.split("@")[0] ?? "You" },
    });
    this.known.add(user.id);
  }
}
