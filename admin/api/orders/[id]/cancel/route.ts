import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { bootstrapPaymentAdapters } from '@/plugins/shop/payments/bootstrap'
import { get as getAdapter } from '@/plugins/shop/payments/registry'
import { logActivity } from '@/plugins/shop/fulfillment/activities'
import { assertOrderTransition, type OrderStatus } from '@/plugins/shop/fulfillment/state-machine'
import { sendNotification } from '@/plugins/shop/notifications/send'

bootstrapPaymentAdapters()

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const { reason } = await req.json().catch(() => ({ reason: null }))
  const orderId = Number(id)
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Validate transition up front (will be re-checked in transaction)
  try {
    assertOrderTransition(order.status as OrderStatus, 'cancelled')
  } catch {
    return NextResponse.json({ error: `cannot cancel from status=${order.status}` }, { status: 400 })
  }

  // Refund if already paid (external API call — outside transaction)
  let refundResult: { success: boolean; refundedAmount: number; errorMessage?: string; pgRefundId?: string } | null = null
  if (order.paidAt && order.paymentGateway && order.pgTransactionId) {
    const adapter = getAdapter(order.paymentGateway)
    if (!adapter) return NextResponse.json({ error: 'adapter unavailable for refund' }, { status: 500 })
    refundResult = await adapter.refund({
      pgTransactionId: order.pgTransactionId,
      amount: order.finalPrice,
      reason: reason ?? 'admin cancel',
      orderRef: order.orderNo,
    })
    if (!refundResult.success) {
      return NextResponse.json({ error: 'refund failed', detail: refundResult.errorMessage }, { status: 502 })
    }
  }

  const outcome = await prisma.$transaction(async tx => {
    const latest = await tx.order.findUnique({ where: { id: orderId } })
    if (!latest) return { type: 'not_found' as const }
    assertOrderTransition(latest.status as OrderStatus, 'cancelled')
    const updateRes = await tx.order.updateMany({
      where: { id: orderId, status: latest.status },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason,
        refundAmount: refundResult?.refundedAmount ?? null,
        refundedAt: refundResult ? new Date() : null,
      },
    })
    if (updateRes.count === 0) return { type: 'race' as const }

    // Restore stock if it was previously decremented (paid path)
    if (latest.paidAt) {
      for (const item of order.items) {
        if (item.optionId) {
          await tx.productOption.update({ where: { id: item.optionId }, data: { stock: { increment: item.quantity } } })
        } else if (item.productId) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } })
        }
        if (item.productId) {
          await tx.product.update({ where: { id: item.productId }, data: { soldCount: { decrement: item.quantity } } })
        }
      }
    }

    await logActivity(tx, {
      orderId, actorType: 'admin', actorId: session.id, action: 'cancelled',
      fromStatus: latest.status, toStatus: 'cancelled',
      payload: { reason, refund: refundResult ? { amount: refundResult.refundedAmount, pgRefundId: refundResult.pgRefundId } : null },
    })
    if (refundResult?.success) {
      await logActivity(tx, {
        orderId, actorType: 'system', action: 'refund_issued',
        payload: { amount: refundResult.refundedAmount, pgRefundId: refundResult.pgRefundId },
      })
    }
    return { type: 'ok' as const }
  })

  if (outcome.type === 'not_found') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (outcome.type === 'race') return NextResponse.json({ error: 'order status changed' }, { status: 409 })
  sendNotification({ event: 'order_cancelled', userId: order.userId, data: { orderNo: order.orderNo, reason } })
    .catch(console.error)
  return NextResponse.json({ ok: true, refund: refundResult })
}
