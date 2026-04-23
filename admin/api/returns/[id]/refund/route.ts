import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { bootstrapPaymentAdapters } from '@/plugins/shop/payments/bootstrap'
import { get as getAdapter } from '@/plugins/shop/payments/registry'
import { assertReturnTransition, type ReturnStatus } from '@/plugins/shop/fulfillment/return-state-machine'
import { calculateRefund } from '@/plugins/shop/fulfillment/refund-calc'
import { logActivity } from '@/plugins/shop/fulfillment/activities'
import { getShopSetting } from '@/plugins/shop/lib/shop-settings'

bootstrapPaymentAdapters()

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params

  const request = await prisma.returnRequest.findUnique({
    where: { id: Number(id) },
    include: { items: true, order: true },
  })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (request.type !== 'return') return NextResponse.json({ error: 'refund only for type=return' }, { status: 400 })
  try {
    assertReturnTransition(request.status as ReturnStatus, 'completed')
  } catch {
    return NextResponse.json({ error: `cannot refund from status=${request.status}` }, { status: 400 })
  }

  const order = request.order
  if (!order.paymentGateway || !order.pgTransactionId) {
    return NextResponse.json({ error: 'order has no payment gateway / transaction id' }, { status: 400 })
  }
  const adapter = getAdapter(order.paymentGateway)
  if (!adapter) return NextResponse.json({ error: 'adapter not registered' }, { status: 500 })

  // Calculate refund amount
  const shippingFeeStr = (await getShopSetting('return_shipping_fee')) ?? '3000'
  const shippingFeeDeduction = request.customerBearsShipping ? Number(shippingFeeStr) : 0
  const calc = calculateRefund({
    items: request.items.map(i => ({ unitPrice: i.unitPrice, quantity: i.quantity })),
    shippingFeeDeduction,
  })

  // Call PG refund (outside transaction — network I/O)
  const refundResult = await adapter.refund({
    pgTransactionId: order.pgTransactionId,
    amount: calc.refundAmount,
    reason: `Return request #${request.id}`,
    orderRef: order.orderNo,
  })
  if (!refundResult.success) {
    return NextResponse.json({ error: 'refund failed', detail: refundResult.errorMessage }, { status: 502 })
  }

  const outcome = await prisma.$transaction(async tx => {
    const latest = await tx.returnRequest.findUnique({ where: { id: request.id } })
    if (!latest || latest.status !== 'collected') return { type: 'race' as const }
    await tx.returnRequest.update({
      where: { id: request.id },
      data: { status: 'completed', refundAmount: calc.refundAmount, refundedAt: new Date() },
    })
    await logActivity(tx, {
      orderId: request.orderId, actorType: 'admin', actorId: session.id,
      action: 'return_refunded',
      payload: { scope: 'return', returnRequestId: request.id, subtotal: calc.subtotal, shippingFeeDeduction, refundAmount: calc.refundAmount, pgRefundId: refundResult.pgRefundId },
    })
    return { type: 'ok' as const }
  })

  if (outcome.type === 'race') return NextResponse.json({ error: 'status changed' }, { status: 409 })
  return NextResponse.json({ ok: true, refund: { amount: calc.refundAmount, pgRefundId: refundResult.pgRefundId } })
}
