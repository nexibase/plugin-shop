import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })
  const { id } = await params
  const request = await prisma.returnRequest.findUnique({
    where: { id: Number(id) },
    include: {
      items: { include: { orderItem: true } },
      order: { select: { orderNo: true, finalPrice: true, status: true } },
    },
  })
  if (!request || request.userId !== session.id) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ request })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })
  const { id } = await params
  const request = await prisma.returnRequest.findUnique({ where: { id: Number(id) } })
  if (!request || request.userId !== session.id) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (request.status !== 'requested') {
    return NextResponse.json({ error: 'can only cancel while status=requested' }, { status: 400 })
  }
  await prisma.$transaction(async tx => {
    await tx.returnRequest.delete({ where: { id: request.id } })
    await logActivity(tx, {
      orderId: request.orderId, actorType: 'customer', actorId: session.id,
      action: 'return_requested',
      payload: { scope: 'return', returnRequestId: request.id, cancelled: true },
    })
  })
  return NextResponse.json({ ok: true })
}
