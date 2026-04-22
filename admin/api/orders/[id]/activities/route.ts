import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }
  const { id } = await params
  const activities = await prisma.orderActivity.findMany({
    where: { orderId: Number(id) },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ activities })
}
