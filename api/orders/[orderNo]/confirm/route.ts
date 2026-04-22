import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertOrderTransition, type OrderStatus } from '@/plugins/shop/fulfillment/state-machine'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

export async function POST(_req: Request, { params }: { params: Promise<{ orderNo: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })
  const { orderNo } = await params

  const outcome = await prisma.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { orderNo } })
    if (!order || order.userId !== session.id) return { type: 'not_found' as const }
    assertOrderTransition(order.status as OrderStatus, 'confirmed')
    const updateRes = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: 'confirmed' },
    })
    if (updateRes.count === 0) return { type: 'race' as const }
    await logActivity(tx, {
      orderId: order.id, actorType: 'customer', actorId: session.id, action: 'status_changed',
      fromStatus: order.status, toStatus: 'confirmed',
    })
    return { type: 'ok' as const }
  })
  if (outcome.type === 'not_found') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (outcome.type === 'race') return NextResponse.json({ error: 'order status changed' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
