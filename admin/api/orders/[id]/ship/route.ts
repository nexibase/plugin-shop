import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertOrderTransition, type OrderStatus } from '@/plugins/shop/fulfillment/state-machine'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const { trackingCompany, trackingNumber } = await req.json()
  if (!trackingCompany || !trackingNumber) {
    return NextResponse.json({ error: 'tracking required' }, { status: 400 })
  }
  const orderId = Number(id)

  const outcome = await prisma.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order) return { type: 'not_found' as const }
    assertOrderTransition(order.status as OrderStatus, 'shipping')
    const updateRes = await tx.order.updateMany({
      where: { id: orderId, status: order.status },  // TOCTOU guard
      data: { status: 'shipping', shippedAt: new Date(), trackingCompany, trackingNumber },
    })
    if (updateRes.count === 0) return { type: 'race' as const }
    await logActivity(tx, {
      orderId, actorType: 'admin', actorId: session.id, action: 'tracking_updated',
      fromStatus: order.status, toStatus: 'shipping',
      payload: { trackingCompany, trackingNumber },
    })
    return { type: 'ok' as const }
  })

  if (outcome.type === 'not_found') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (outcome.type === 'race') return NextResponse.json({ error: 'order status changed' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
