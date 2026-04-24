import type { Prisma, PrismaClient } from '@prisma/client'

export type ActorType = 'customer' | 'admin' | 'system'

export type ActivityAction =
  | 'order_created'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'status_changed'
  | 'tracking_updated'
  | 'memo_updated'
  | 'cancel_requested'
  | 'cancelled'
  | 'refund_issued'
  | 'exchange_sent'

export interface LogActivityInput {
  orderId: number
  actorType: ActorType
  actorId?: number | null
  action: ActivityAction
  fromStatus?: string | null
  toStatus?: string | null
  payload?: Prisma.InputJsonValue
  memo?: string | null
}

/**
 * Record an append-only audit event for an order.
 * Accepts a Prisma client or transaction client so callers can bundle with business writes.
 */
export async function logActivity(
  db: PrismaClient | Prisma.TransactionClient,
  input: LogActivityInput,
): Promise<void> {
  await db.orderActivity.create({
    data: {
      orderId: input.orderId,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      payload: input.payload ?? undefined,
      memo: input.memo ?? null,
    },
  })
}
