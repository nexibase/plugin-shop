import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { logActivity } from '@/plugins/shop/fulfillment/activities'
import { getShopSetting } from '@/plugins/shop/lib/shop-settings'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })
  const requests = await prisma.returnRequest.findMany({
    where: { userId: session.id },
    include: { items: true, order: { select: { orderNo: true, finalPrice: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ requests })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })

  const body = await req.json() as {
    orderNo: string
    type: 'return' | 'exchange'
    reason: string
    reasonDetail?: string
    photos?: string[]
    items: { orderItemId: number; quantity: number }[]
  }

  if (!['return', 'exchange'].includes(body.type)) {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 })
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items required' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { orderNo: body.orderNo },
    include: { items: true },
  })
  if (!order || order.userId !== session.id) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 })
  }

  // Guard: order must be in delivered or confirmed status, within return window
  if (!['delivered', 'confirmed'].includes(order.status)) {
    return NextResponse.json({ error: `cannot request while order is ${order.status}` }, { status: 400 })
  }
  const windowDaysStr = (await getShopSetting('return_window_days')) ?? '7'
  const windowDays = Number(windowDaysStr)
  const deliveredAt = order.deliveredAt
  if (!deliveredAt) {
    return NextResponse.json({ error: 'order has no delivery date' }, { status: 400 })
  }
  const cutoff = new Date(deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000)
  if (Date.now() > cutoff.getTime()) {
    return NextResponse.json({ error: `return window (${windowDays} days) has passed` }, { status: 400 })
  }

  // Validate each requested item exists and quantity is within the order's quantity
  for (const req of body.items) {
    const oi = order.items.find(i => i.id === req.orderItemId)
    if (!oi) return NextResponse.json({ error: `order item ${req.orderItemId} not in this order` }, { status: 400 })
    if (req.quantity <= 0 || req.quantity > oi.quantity) {
      return NextResponse.json({ error: `invalid quantity for item ${req.orderItemId}` }, { status: 400 })
    }
  }

  // Guard: no open return request on the same order_item already
  const existingOpen = await prisma.returnItem.findMany({
    where: {
      orderItemId: { in: body.items.map(i => i.orderItemId) },
      returnRequest: { status: { in: ['requested', 'approved', 'collected'] } },
    },
  })
  if (existingOpen.length > 0) {
    return NextResponse.json({ error: 'open return request exists for one or more items' }, { status: 400 })
  }

  const request = await prisma.$transaction(async tx => {
    const created = await tx.returnRequest.create({
      data: {
        orderId: order.id,
        userId: session.id,
        type: body.type,
        reason: body.reason,
        reasonDetail: body.reasonDetail ?? null,
        photos: body.photos ?? undefined,
        status: 'requested',
        items: {
          create: body.items.map(it => {
            const oi = order.items.find(i => i.id === it.orderItemId)!
            return {
              orderItemId: oi.id,
              quantity: it.quantity,
              unitPrice: oi.price,
            }
          }),
        },
      },
      include: { items: true },
    })
    await logActivity(tx, {
      orderId: order.id,
      actorType: 'customer',
      actorId: session.id,
      action: 'return_requested',
      payload: { scope: 'return', returnRequestId: created.id, type: body.type, reason: body.reason, itemCount: body.items.length },
    })
    return created
  })

  return NextResponse.json({ request }, { status: 201 })
}
