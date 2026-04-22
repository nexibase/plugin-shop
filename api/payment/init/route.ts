import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { bootstrapPaymentAdapters } from '@/plugins/shop/payments/bootstrap'
import { resolveMethodToAdapter } from '@/plugins/shop/payments/registry'
import { logActivity } from '@/plugins/shop/fulfillment/activities'
import type { PayMethod } from '@/plugins/shop/payments/adapter'

bootstrapPaymentAdapters()

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })

  const body = await req.json()
  const { items, buyer, shipping, method } = body as {
    items: { productId: number; optionId: number | null; quantity: number }[]
    buyer: { name: string; phone: string; email?: string }
    // Note: client may send deliveryFee for display purposes, but the server
    // always recalculates it from the delivery-fee policy table (Critical 1 fix).
    shipping: { recipientName: string; recipientPhone: string; zipCode: string; address: string; addressDetail?: string; deliveryMemo?: string }
    method: PayMethod
  }

  const adapter = await resolveMethodToAdapter(method)
  if (!adapter) return NextResponse.json({ error: 'payment method unavailable' }, { status: 400 })

  const orderNo = await generateOrderNo()
  const { totalPrice, orderItems } = await buildOrderDraft(items)

  // Always calculate deliveryFee server-side — never trust the client value.
  // Ported verbatim from src/plugins/shop/api/orders/route.ts:367-418.
  const { fee: deliveryFee } = await calculateDeliveryFee(shipping.zipCode, totalPrice)
  const finalPrice = totalPrice + deliveryFee

  const order = await prisma.$transaction(async tx => {
    const created = await tx.order.create({
      data: {
        orderNo, userId: session.id,
        ordererName: buyer.name, ordererPhone: buyer.phone, ordererEmail: buyer.email,
        recipientName: shipping.recipientName, recipientPhone: shipping.recipientPhone,
        zipCode: shipping.zipCode, address: shipping.address, addressDetail: shipping.addressDetail,
        deliveryMemo: shipping.deliveryMemo,
        totalPrice, deliveryFee, finalPrice,
        status: 'pending', paymentMethod: method, paymentGateway: adapter.id,
        items: { create: orderItems },
      },
    })
    await logActivity(tx, {
      orderId: created.id, actorType: 'customer', actorId: session.id, action: 'order_created',
      toStatus: 'pending', payload: { method, adapterId: adapter.id, amount: finalPrice },
    })
    return created
  })

  const baseUrl = new URL(req.url).origin
  const prepare = await adapter.prepare(
    { id: order.id, orderNo: order.orderNo, finalPrice, ordererName: buyer.name, ordererPhone: buyer.phone, ordererEmail: buyer.email, items: orderItems.map(i => ({ productName: i.productName, quantity: i.quantity })) },
    { returnUrl: `${baseUrl}/api/shop/payment/callback/${adapter.id}`, closeUrl: `${baseUrl}/shop/order` },
  )
  return NextResponse.json({ orderNo: order.orderNo, prepare })
}

// Build an order number (YYMMDDHH-iiXXXXX = 16 chars, ii=minute, with uniqueness check)
// Ported verbatim from src/plugins/shop/api/orders/route.ts:341-365
async function generateOrderNo(): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const MM = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const ii = String(now.getMinutes()).padStart(2, '0')

  // Try up to 10 times
  for (let i = 0; i < 10; i++) {
    const rand = String(Math.floor(Math.random() * 100000)).padStart(5, '0')
    const orderNo = `${yy}${MM}${dd}${hh}-${ii}${rand}`

    // Duplicate check
    const exists = await prisma.order.findUnique({ where: { orderNo } })
    if (!exists) {
      return orderNo
    }
  }

  // Fall back to seconds + random after 10 failures
  const ss = String(now.getSeconds()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `${yy}${MM}${dd}${hh}-${ii}${ss}${rand}`
}

interface OrderItem {
  productId: number
  optionId: number | null
  productName: string
  optionText: string
  price: number
  quantity: number
  subtotal: number
}

// Validate items, compute prices, return order item rows ready for prisma create.
// Ported verbatim from src/plugins/shop/api/orders/route.ts:61-137 (item loop).
// deliveryFee is computed separately via calculateDeliveryFee — not accepted from client.
async function buildOrderDraft(
  items: { productId: number; optionId: number | null; quantity: number }[],
): Promise<{ totalPrice: number; orderItems: OrderItem[] }> {
  let totalPrice = 0
  const orderItems: OrderItem[] = []

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: {
        options: item.optionId ? {
          where: { id: item.optionId }
        } : undefined
      }
    })

    if (!product || !product.isActive) {
      throw new Error(`상품을 찾을 수 없습니다: ${item.productId}`)
    }

    if (product.isSoldOut) {
      throw new Error(`품절된 상품입니다: ${product.name}`)
    }

    let price = product.price
    let optionText = ''

    // 옵션이 있는 경우
    if (item.optionId) {
      const option = product.options?.[0]
      if (!option || !option.isActive) {
        throw new Error(`옵션을 찾을 수 없습니다: ${product.name}`)
      }

      if (option.stock < item.quantity) {
        throw new Error(`재고가 부족합니다: ${product.name} (재고: ${option.stock})`)
      }

      price = option.price
      const optionParts = []
      if (option.option1) optionParts.push(option.option1)
      if (option.option2) optionParts.push(option.option2)
      if (option.option3) optionParts.push(option.option3)
      optionText = optionParts.join(' / ')
    }

    const subtotal = price * item.quantity
    totalPrice += subtotal

    orderItems.push({
      productId: product.id,
      optionId: item.optionId || null,
      productName: product.name,
      optionText,
      price,
      quantity: item.quantity,
      subtotal,
    })
  }

  return { totalPrice, orderItems }
}

// Calculate shipping fee from the delivery-fee policy table.
// Ported verbatim from src/plugins/shop/api/orders/route.ts:367-418.
async function calculateDeliveryFee(zipCode: string, totalPrice: number): Promise<{ fee: number; policyName: string }> {
  const policies = await prisma.deliveryFee.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  if (policies.length === 0) {
    return { fee: 0, policyName: '무료배송' }
  }

  const zipNum = parseInt(zipCode)

  // 지역별 정책 매칭
  for (const policy of policies) {
    if (policy.isDefault) continue

    try {
      const regions = JSON.parse(policy.regions || '[]') as string[]
      for (const region of regions) {
        if (region.includes('-')) {
          const [start, end] = region.split('-').map(r => parseInt(r.trim()))
          if (zipNum >= start && zipNum <= end) {
            if (policy.freeAmount && totalPrice >= policy.freeAmount) {
              return { fee: 0, policyName: `${policy.name} (무료배송)` }
            }
            return { fee: policy.fee, policyName: policy.name }
          }
        } else if (zipCode.startsWith(region.trim())) {
          if (policy.freeAmount && totalPrice >= policy.freeAmount) {
            return { fee: 0, policyName: `${policy.name} (무료배송)` }
          }
          return { fee: policy.fee, policyName: policy.name }
        }
      }
    } catch {
      continue
    }
  }

  // 기본 정책 적용
  const defaultPolicy = policies.find(p => p.isDefault)
  if (defaultPolicy) {
    if (defaultPolicy.freeAmount && totalPrice >= defaultPolicy.freeAmount) {
      return { fee: 0, policyName: `${defaultPolicy.name} (무료배송)` }
    }
    return { fee: defaultPolicy.fee, policyName: defaultPolicy.name }
  }

  return { fee: 0, policyName: '무료배송' }
}
