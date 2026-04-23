import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })
  const { id } = await params
  const { returnTrackingCompany, returnTrackingNumber } = await req.json()
  if (!returnTrackingCompany || !returnTrackingNumber) {
    return NextResponse.json({ error: 'tracking required' }, { status: 400 })
  }
  const request = await prisma.returnRequest.findUnique({ where: { id: Number(id) } })
  if (!request || request.userId !== session.id) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (request.status !== 'approved') {
    return NextResponse.json({ error: 'can only update tracking while status=approved' }, { status: 400 })
  }
  await prisma.returnRequest.update({
    where: { id: request.id },
    data: { returnTrackingCompany, returnTrackingNumber },
  })
  return NextResponse.json({ ok: true })
}
