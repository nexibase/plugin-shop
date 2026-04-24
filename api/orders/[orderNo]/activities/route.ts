import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { orderNo } = await params
  const order = await prisma.order.findUnique({
    where: { orderNo },
    select: { id: true, userId: true },
  })
  if (!order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (order.userId !== session.id && session.role !== 'admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const rows = await prisma.orderActivity.findMany({
    where: {
      orderId: order.id,
      action: { not: 'memo_updated' },
    },
    orderBy: { createdAt: 'desc' },
  })

  const activities = rows.map((a) => ({
    id: a.id,
    actorType: a.actorType,
    action: a.action,
    fromStatus: a.fromStatus,
    toStatus: a.toStatus,
    payload: a.payload,
    memo: a.memo,
    createdAt: a.createdAt,
  }))

  return NextResponse.json({ activities })
}
