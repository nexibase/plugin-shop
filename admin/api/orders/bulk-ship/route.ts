import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertOrderTransition, type OrderStatus } from '@/plugins/shop/fulfillment/state-machine'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { items } = await req.json() as { items: { orderId: number; trackingCompany: string; trackingNumber: string }[] }
  const results: { orderId: number; ok: boolean; error?: string }[] = []
  for (const it of items) {
    try {
      const outcome = await prisma.$transaction(async tx => {
        const order = await tx.order.findUnique({ where: { id: it.orderId } })
        if (!order) return { type: 'not_found' as const }
        assertOrderTransition(order.status as OrderStatus, 'shipping')
        const updateRes = await tx.order.updateMany({
          where: { id: it.orderId, status: order.status },
          data: { status: 'shipping', shippedAt: new Date(), trackingCompany: it.trackingCompany, trackingNumber: it.trackingNumber },
        })
        if (updateRes.count === 0) return { type: 'race' as const }
        await logActivity(tx, {
          orderId: it.orderId, actorType: 'admin', actorId: session.id, action: 'tracking_updated',
          fromStatus: order.status, toStatus: 'shipping',
          payload: { trackingCompany: it.trackingCompany, trackingNumber: it.trackingNumber },
        })
        return { type: 'ok' as const }
      })
      if (outcome.type === 'ok') results.push({ orderId: it.orderId, ok: true })
      else results.push({ orderId: it.orderId, ok: false, error: outcome.type })
    } catch (e: unknown) {
      results.push({ orderId: it.orderId, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return NextResponse.json({ results })
}
