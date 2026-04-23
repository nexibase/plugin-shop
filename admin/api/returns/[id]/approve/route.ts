import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertReturnTransition, type ReturnStatus } from '@/plugins/shop/fulfillment/return-state-machine'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const { customerBearsShipping, adminMemo } = await req.json() as { customerBearsShipping: boolean; adminMemo?: string }

  const outcome = await prisma.$transaction(async tx => {
    const request = await tx.returnRequest.findUnique({ where: { id: Number(id) } })
    if (!request) return { type: 'not_found' as const }
    assertReturnTransition(request.status as ReturnStatus, 'approved')
    const updateRes = await tx.returnRequest.updateMany({
      where: { id: request.id, status: request.status },
      data: { status: 'approved', customerBearsShipping: !!customerBearsShipping, adminMemo: adminMemo ?? null },
    })
    if (updateRes.count === 0) return { type: 'race' as const }
    await logActivity(tx, {
      orderId: request.orderId, actorType: 'admin', actorId: session.id,
      action: 'return_approved',
      payload: { scope: 'return', returnRequestId: request.id, customerBearsShipping: !!customerBearsShipping },
    })
    return { type: 'ok' as const }
  })

  if (outcome.type === 'not_found') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (outcome.type === 'race') return NextResponse.json({ error: 'status changed' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
