import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { bootstrapPaymentAdapters } from '@/plugins/shop/payments/bootstrap'
import { get as getAdapter } from '@/plugins/shop/payments/registry'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

bootstrapPaymentAdapters()

/**
 * Minimal admin refund — "just do the thing" partial/full refund.
 *
 * Body: { amount: number, reason?: string }
 *
 * Steps:
 *   1. Validate: amount <= (finalPrice - already refunded)
 *   2. Call PG refund (outside tx — network I/O)
 *   3. Transaction:
 *      - Accumulate order.refundAmount, set refundedAt
 *      - If fully refunded → status='refunded' (or 'cancelled' if not paid yet? Just use 'refunded')
 *      - Log activity `refund_issued`
 *
 * Stock restoration: NOT automatic. Admin handles stock in product admin page
 * if needed (typical for small shops — usually no stock issue anyway).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const orderId = Number(id)

  const { amount, reason } = await req.json() as { amount: number; reason?: string }
  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: '금액을 입력해 주세요' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const alreadyRefunded = order.refundAmount ?? 0
  const refundable = order.finalPrice - alreadyRefunded
  if (amount > refundable) {
    return NextResponse.json({ error: `환불 가능 금액은 ${refundable.toLocaleString()}원입니다` }, { status: 400 })
  }

  // Call PG refund if we have a gateway + transaction (skip for bank_deposit / pre-payment)
  let pgRefundId: string | null = null
  if (order.paymentGateway && order.pgTransactionId && order.paidAt) {
    const adapter = getAdapter(order.paymentGateway)
    if (adapter) {
      const res = await adapter.refund({
        pgTransactionId: order.pgTransactionId,
        amount,
        reason: reason ?? '관리자 환불',
        orderRef: order.orderNo,
      })
      if (!res.success) {
        return NextResponse.json(
          { error: '환불 실패', detail: res.errorMessage },
          { status: 502 },
        )
      }
      pgRefundId = res.pgRefundId ?? null
    }
    // If adapter not found: skip PG call, just record internally. Admin handles manually.
  }

  const newRefundTotal = alreadyRefunded + amount
  const isFullRefund = newRefundTotal >= order.finalPrice

  await prisma.$transaction(async tx => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        refundAmount: newRefundTotal,
        refundedAt: new Date(),
        cancelReason: reason ?? order.cancelReason,
        // Move order to refunded status when fully refunded (admin-driven)
        ...(isFullRefund && !['cancelled', 'refunded'].includes(order.status) ? { status: 'refunded' } : {}),
      },
    })
    await logActivity(tx, {
      orderId,
      actorType: 'admin',
      actorId: session.id,
      action: 'refund_issued',
      payload: {
        amount,
        cumulativeRefund: newRefundTotal,
        remainingAfter: order.finalPrice - newRefundTotal,
        reason: reason ?? null,
        pgRefundId,
        isFullRefund,
      },
      memo: reason ?? null,
    })
  })

  return NextResponse.json({
    ok: true,
    amount,
    cumulativeRefund: newRefundTotal,
    isFullRefund,
    pgRefundId,
  })
}
