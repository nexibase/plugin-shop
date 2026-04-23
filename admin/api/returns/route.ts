import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? undefined
  const type = url.searchParams.get('type') ?? undefined
  const where: { status?: string; type?: string } = {}
  if (status) where.status = status
  if (type) where.type = type
  const requests = await prisma.returnRequest.findMany({
    where,
    include: {
      items: true,
      order: { select: { id: true, orderNo: true, recipientName: true, finalPrice: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ requests })
}
