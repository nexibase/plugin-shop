import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bootstrapPaymentAdapters } from '@/plugins/shop/payments/bootstrap'
import { get } from '@/plugins/shop/payments/registry'
import { logActivity } from '@/plugins/shop/fulfillment/activities'
import { assertOrderTransition, type OrderStatus } from '@/plugins/shop/fulfillment/state-machine'

bootstrapPaymentAdapters()

export async function POST(req: Request, { params }: { params: Promise<{ adapterId: string }> }) {
  const { adapterId } = await params
  const adapter = get(adapterId)
  if (!adapter) return NextResponse.json({ error: 'unknown adapter' }, { status: 404 })

  // Parse the PG callback payload and extract the order number via adapter methods
  // (IMPORTANT 4: adapter-level parseCallbackRequest / extractOrderNo).
  const raw = await adapter.parseCallbackRequest(req)
  const result = await adapter.handleCallback(raw)
  const orderNo = adapter.extractOrderNo(raw)

  // CRITICAL 2: move findUnique + assertOrderTransition INSIDE the transaction
  // so that reads and writes are atomic — prevents TOCTOU race conditions.
  const outcome = await prisma.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { orderNo } })
    if (!order) return { type: 'not_found' as const }

    if (!result.success) {
      // IMPORTANT 3: skip if order was already finalized (idempotency guard).
      if (order.status === 'paid' || order.status === 'cancelled') {
        return { type: 'already_finalized' as const, orderNo }
      }
      assertOrderTransition(order.status as OrderStatus, 'cancelled')
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'cancelled', cancelReason: result.errorMessage ?? 'payment failed', cancelledAt: new Date() },
      })
      await logActivity(tx, {
        orderId: order.id, actorType: 'system', action: 'payment_failed',
        fromStatus: order.status, toStatus: 'cancelled',
        payload: { raw: JSON.parse(JSON.stringify(result.rawResponse)), error: result.errorMessage },
      })
      return { type: 'failure' as const, orderNo }
    }

    // Success path — use updateMany with status='pending' guard for race detection.
    assertOrderTransition(order.status as OrderStatus, 'paid')
    const updateRes = await tx.order.updateMany({
      where: { id: order.id, status: 'pending' },
      data: {
        status: 'paid', paidAt: new Date(),
        paymentMethod: result.method,
        pgTransactionId: result.pgTransactionId,
        paymentInfo: JSON.stringify(result.rawResponse),
      },
    })
    if (updateRes.count === 0) {
      throw new Error('race: order status changed during callback processing')
    }

    // Decrement stock for each order item.
    // Ported verbatim from src/plugins/shop/api/payment/inicis/return/route.ts:302-328.
    const orderItems = await tx.orderItem.findMany({ where: { orderId: order.id } })
    for (const item of orderItems) {
      if (item.optionId) {
        // When options exist: decrement option stock
        await tx.productOption.update({ where: { id: item.optionId }, data: { stock: { decrement: item.quantity } } })
      } else if (item.productId) {
        // When options are absent: decrement product stock
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } })
      }
      if (item.productId) {
        // Increment sold quantity
        await tx.product.update({ where: { id: item.productId }, data: { soldCount: { increment: item.quantity } } })
      }
    }

    await logActivity(tx, {
      orderId: order.id, actorType: 'system', action: 'payment_succeeded',
      fromStatus: order.status, toStatus: 'paid',
      payload: { amount: result.paidAmount, pgTransactionId: result.pgTransactionId, method: result.method },
    })
    return { type: 'success' as const, orderNo }
  })

  if (outcome.type === 'not_found') return NextResponse.json({ error: 'order not found' }, { status: 404 })
  if (outcome.type === 'failure') return NextResponse.redirect(new URL(`/shop/order/failed?orderNo=${outcome.orderNo}`, req.url))
  // Both 'already_finalized' and 'success' redirect to the complete page.
  return NextResponse.redirect(new URL(`/shop/order/complete?orderNo=${outcome.orderNo}`, req.url))
}
