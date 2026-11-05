import { Inject, Injectable } from "@nestjs/common";
import type {
  OperationResult,
  PullResponse,
  PushRequest,
  PushResponse,
} from "@productivity/contracts";
import { PrismaService } from "../common/prisma.module";
import { SYNC_HANDLERS, type SyncHandler } from "./sync-handler";

const PULL_LIMIT = 500;

@Injectable()
export class SyncService {
  private readonly handlers: Map<string, SyncHandler>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SYNC_HANDLERS) handlers: SyncHandler[],
  ) {
    this.handlers = new Map(handlers.map((h) => [h.entityType, h]));
  }

  /** Plan §6.4 steps 2–4: apply each operation idempotently, one result each. */
  async push(userId: string, body: PushRequest): Promise<PushResponse> {
    const results: OperationResult[] = [];

    for (const op of body.operations) {
      const result = await this.prisma.$transaction(async (tx) => {
        // Per-user lock so change_seq values commit in the order they were
        // assigned; otherwise a puller could skip a row (plan §6.2).
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

        const already = await tx.syncChange.findUnique({
          where: { userId_operationId: { userId, operationId: op.operationId } },
        });
        if (already) {
          // A retried push: acknowledge without re-applying.
          return { operationId: op.operationId, status: "accepted", version: Number(already.version) } as const;
        }

        const handler = this.handlers.get(op.entityType);
        if (!handler) {
          return { operationId: op.operationId, status: "rejected", reason: "unknown_entity" } as const;
        }

        const r = await handler.apply(tx, userId, op);
        if (r.status === "accepted") {
          await tx.syncChange.create({
            data: {
              userId,
              entityType: op.entityType,
              entityId: op.entityId,
              operationId: op.operationId,
              op: op.op,
              version: BigInt(r.version),
              originDeviceId: null, // set once devices are registered (Phase 1)
            },
          });
        }
        return r;
      });
      results.push(result);
    }

    return { results };
  }

  /** Plan §6.4 step 5: changes after the cursor, oldest first. */
  async pull(userId: string, cursor: number): Promise<PullResponse> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.syncChange.findMany({
        where: { userId, changeSeq: { gt: BigInt(cursor) } },
        orderBy: { changeSeq: "asc" },
        take: PULL_LIMIT + 1,
      });
      const page = rows.slice(0, PULL_LIMIT);

      // Send each entity's *current* state once, at its latest change.
      const latest = new Map<string, (typeof page)[number]>();
      for (const r of page) latest.set(`${r.entityType}:${r.entityId}`, r);

      const byType = new Map<string, string[]>();
      for (const r of latest.values()) {
        byType.set(r.entityType, [...(byType.get(r.entityType) ?? []), r.entityId]);
      }
      const records = new Map<string, Record<string, unknown>>();
      for (const [type, ids] of byType) {
        const loaded = await this.handlers.get(type)?.load(tx, userId, ids);
        loaded?.forEach((rec, id) => records.set(`${type}:${id}`, rec));
      }

      const changes = [...latest.values()].map((r) => {
        const record = records.get(`${r.entityType}:${r.entityId}`) ?? null;
        return {
          changeSeq: Number(r.changeSeq),
          entityType: r.entityType as PullResponse["changes"][number]["entityType"],
          entityId: r.entityId,
          op: (record?.deletedAt ? "delete" : "upsert") as "upsert" | "delete",
          version: Number(r.version),
          record,
        };
      });

      return {
        changes,
        cursor: page.length ? Number(page[page.length - 1]!.changeSeq) : cursor,
        hasMore: rows.length > PULL_LIMIT,
      };
    });
  }
}
