import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

/**
 * Create a free replacement order for exchange.
 *
 * Body: { items: [{orderItemId, quantity}], memo? }
 *
 * Result: a new order with orderType='exchange', finalPrice=0,
 * status='preparing', originalOrderId chain pointing at the root.
 * Admin can then treat it like any normal preparing order (enter tracking, etc).
 *
 * NOT automatic: stock change, refund. This is literally "ship a replacement".
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const orderId = Number(id)

  const { items, memo } = await req.json() as {
    items: { orderItemId: number; quantity: number }[]
    memo?: string
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: '항목을 선택해 주세요' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Validate items and build snapshots
  const orderItemSnapshots: { productId: number | null; optionId: number | null; productName: string; optionText: string | null; quantity: number }[] = []
  for (const it of items) {
    const oi = order.items.find(o => o.id === it.orderItemId)
    if (!oi) return NextResponse.json({ error: `잘못된 주문 항목 ${it.orderItemId}` }, { status: 400 })
    if (it.quantity <= 0 || it.quantity > oi.quantity) {
      return NextResponse.json({ error: `${oi.productName}: 수량이 올바르지 않습니다 (최대 ${oi.quantity})` }, { status: 400 })
    }
    orderItemSnapshots.push({
      productId: oi.productId,
      optionId: oi.optionId,
      productName: oi.productName,
      optionText: oi.optionText,
      quantity: it.quantity,
    })
  }

  const originalRoot = order.originalOrderId ?? order.id

  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const rand = Math.floor(1000000 + Math.random() * 9000000)
  const newOrderNo = `${yy}${mm}${dd}${hh}-${rand}`

  const replacement = await prisma.$transaction(async tx => {
    const created = await tx.order.create({
      data: {
        orderNo: newOrderNo,
        userId: order.userId,
        ordererName: order.ordererName, ordererPhone: order.ordererPhone, ordererEmail: order.ordererEmail,
        recipientName: order.recipientName, recipientPhone: order.recipientPhone,
        zipCode: order.zipCode, address: order.address, addressDetail: order.addressDetail,
        deliveryMemo: order.deliveryMemo,
        totalPrice: 0, deliveryFee: 0, finalPrice: 0,
        status: 'preparing',
        paymentMethod: null, paymentGateway: null,
        orderType: 'exchange',
        originalOrderId: originalRoot,
        adminMemo: memo ?? null,
        items: {
          create: orderItemSnapshots.map(it => ({
            productId: it.productId,
            optionId: it.optionId,
            productName: it.productName,
            optionText: it.optionText,
            price: 0,
            quantity: it.quantity,
            subtotal: 0,
          })),
        },
      },
    })

    // Log on the original order
    await logActivity(tx, {
      orderId: order.id,
      actorType: 'admin',
      actorId: session.id,
      action: 'exchange_sent',
      payload: {
        replacementOrderNo: created.orderNo,
        replacementOrderId: created.id,
        itemCount: orderItemSnapshots.length,
        totalQty: orderItemSnapshots.reduce((s, i) => s + i.quantity, 0),
      },
      memo: memo ?? null,
    })

    // Log on the replacement order
    await logActivity(tx, {
      orderId: created.id,
      actorType: 'admin',
      actorId: session.id,
      action: 'order_created',
      toStatus: 'preparing',
      payload: {
        exchange: true,
        originalOrderId: originalRoot,
        fromOrderNo: order.orderNo,
      },
    })

    return created
  })

  return NextResponse.json({
    ok: true,
    replacementOrderId: replacement.id,
    replacementOrderNo: replacement.orderNo,
  })
}
