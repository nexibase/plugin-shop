import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const request = await prisma.returnRequest.findUnique({
    where: { id: Number(id) },
    include: {
      items: { include: { orderItem: true } },
      order: true,
      replacementOrder: true,
    },
  })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ request })
}
