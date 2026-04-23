import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertReturnTransition, type ReturnStatus } from '@/plugins/shop/fulfillment/return-state-machine'
import { logActivity } from '@/plugins/shop/fulfillment/activities'
import { sendNotification } from '@/plugins/shop/notifications/send'

function generateOrderNo(): string {
  // Format: YYMMDDHH-7digit. Collision-free enough for this use case.
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const rand = Math.floor(1000000 + Math.random() * 9000000)
  return `${yy}${mm}${dd}${hh}-${rand}`
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params

  const request = await prisma.returnRequest.findUnique({
    where: { id: Number(id) },
    include: { items: { include: { orderItem: true } }, order: true },
  })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (request.type !== 'exchange') return NextResponse.json({ error: 'exchange-order only for type=exchange' }, { status: 400 })
  try {
    assertReturnTransition(request.status as ReturnStatus, 'completed')
  } catch {
    return NextResponse.json({ error: `cannot create exchange order from status=${request.status}` }, { status: 400 })
  }
  if (request.replacementOrderId) {
    return NextResponse.json({ error: 'replacement order already exists' }, { status: 400 })
  }

  const order = request.order
  const originalRoot = order.originalOrderId ?? order.id

  const outcome = await prisma.$transaction(async tx => {
    const latest = await tx.returnRequest.findUnique({ where: { id: request.id } })
    if (!latest || latest.status !== 'collected') return { type: 'race' as const }

    const replacement = await tx.order.create({
      data: {
        orderNo: generateOrderNo(),
        userId: order.userId,
        ordererName: order.ordererName, ordererPhone: order.ordererPhone, ordererEmail: order.ordererEmail,
        recipientName: order.recipientName, recipientPhone: order.recipientPhone,
        zipCode: order.zipCode, address: order.address, addressDetail: order.addressDetail,
        deliveryMemo: order.deliveryMemo,
        totalPrice: 0, deliveryFee: 0, finalPrice: 0,
        status: 'preparing',   // no payment required — ready to ship
        paymentMethod: null, paymentGateway: null,
        orderType: 'exchange',
        originalOrderId: originalRoot,
        items: {
          create: request.items.map(it => ({
            productId: it.orderItem.productId,
            optionId: it.orderItem.optionId,
            productName: it.orderItem.productName,
            optionText: it.orderItem.optionText,
            price: 0,                // free replacement
            quantity: it.quantity,
            subtotal: 0,
          })),
        },
      },
    })
    // Decrement stock for the replacement items (no payment-succeed path handles this)
    for (const it of request.items) {
      const oi = it.orderItem
      if (oi.optionId) {
        await tx.productOption.update({ where: { id: oi.optionId }, data: { stock: { decrement: it.quantity } } })
      } else if (oi.productId) {
        await tx.product.update({ where: { id: oi.productId }, data: { stock: { decrement: it.quantity } } })
      }
    }
    await tx.returnRequest.update({
      where: { id: request.id },
      data: { status: 'completed', replacementOrderId: replacement.id },
    })
    await logActivity(tx, {
      orderId: request.orderId, actorType: 'admin', actorId: session.id,
      action: 'return_exchange_order_created',
      payload: { scope: 'return', returnRequestId: request.id, replacementOrderId: replacement.id, replacementOrderNo: replacement.orderNo },
    })
    // Also log on the replacement order
    await logActivity(tx, {
      orderId: replacement.id, actorType: 'admin', actorId: session.id, action: 'order_created',
      toStatus: 'preparing', payload: { exchange: true, originalOrderId: originalRoot, returnRequestId: request.id },
    })
    return { type: 'ok' as const, replacementId: replacement.id, replacementOrderNo: replacement.orderNo }
  })

  if (outcome.type === 'race') return NextResponse.json({ error: 'status changed' }, { status: 409 })
  sendNotification({ event: 'exchange_sent', userId: request.userId, data: { returnRequestId: request.id, replacementOrderNo: outcome.replacementOrderNo } })
    .catch(console.error)
  return NextResponse.json({ ok: true, replacementOrderId: outcome.replacementId, replacementOrderNo: outcome.replacementOrderNo })
}
