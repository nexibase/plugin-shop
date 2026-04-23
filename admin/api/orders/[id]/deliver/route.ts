import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertOrderTransition, type OrderStatus } from '@/plugins/shop/fulfillment/state-machine'
import { logActivity } from '@/plugins/shop/fulfillment/activities'
import { sendNotification } from '@/plugins/shop/notifications/send'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const orderId = Number(id)

  const outcome = await prisma.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order) return { type: 'not_found' as const }
    assertOrderTransition(order.status as OrderStatus, 'delivered')
    const updateRes = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: 'delivered', deliveredAt: new Date() },
    })
    if (updateRes.count === 0) return { type: 'race' as const }
    await logActivity(tx, {
      orderId, actorType: 'admin', actorId: session.id, action: 'status_changed',
      fromStatus: order.status, toStatus: 'delivered',
    })
    return { type: 'ok' as const, userId: order.userId, orderNo: order.orderNo }
  })

  if (outcome.type === 'not_found') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (outcome.type === 'race') return NextResponse.json({ error: 'order status changed' }, { status: 409 })
  sendNotification({ event: 'order_delivered', userId: outcome.userId, data: { orderNo: outcome.orderNo } })
    .catch(console.error)
  return NextResponse.json({ ok: true })
}
