import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createOrderStatusNotification, createOrderCancelledByAdminNotification } from '@/lib/notification'
import { logActivity } from '@/plugins/shop/fulfillment/activities'
import crypto from 'crypto'

// Load shop settings
async function getShopSettings() {
  const settings = await prisma.shopSetting.findMany()
  const settingsMap: Record<string, string> = {}
  settings.forEach(s => {
    settingsMap[s.key] = s.value
  })
  return settingsMap
}

// Check whether the order is still pre-shipping
function isBeforeShipping(status: string): boolean {
  return ['pending', 'paid', 'preparing'].includes(status)
}

// Extract tid from paymentInfo
function getPaymentTid(paymentInfo: string | null): string | null {
  if (!paymentInfo) return null
  try {
    const data = typeof paymentInfo === 'string' ? JSON.parse(paymentInfo) : paymentInfo
    return data.tid || null
  } catch {
    return null
  }
}

// Build a timestamp (YYYYMMDDhhmmss)
function getTimestamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}${hours}${minutes}${seconds}`
}

// Inicis payment cancellation (direct v2 API call)
async function cancelInicisPayment(tid: string, cancelReason: string, settings: Record<string, string>) {
  const testMode = settings.pg_test_mode !== 'false'
  const mid = testMode ? 'INIpayTest' : (settings.pg_mid || 'INIpayTest')
  const iniApiKey = testMode ? 'ItEQKi3rY7uvDS8l' : (settings.pg_apikey || '')

  if (!testMode && !iniApiKey) {
    return { success: false, message: 'PG API Key가 설정되지 않았습니다.' }
  }

  // 10-second timeout via AbortController
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const apiUrl = 'https://iniapi.inicis.com/v2/pg/refund'
    const timestamp = getTimestamp()
    const type = 'refund'
    const clientIp = '127.0.0.1'

    // Build the data object
    const data = {
      tid: tid,
      msg: cancelReason
    }

    // Build the hash data (official sample: key + mid + type + timestamp + JSON.stringify(data))
    const dataStr = JSON.stringify(data)
    const plainTxt = iniApiKey + mid + type + timestamp + dataStr
    const hashData = crypto.createHash('sha512').update(plainTxt).digest('hex')

    // Request parameters
    const params = {
      mid: mid,
      type: type,
      timestamp: timestamp,
      clientIp: clientIp,
      data: data,
      hashData: hashData
    }

    console.log('inicis cancellation request (admin):', { mid, tid, type, timestamp, testMode })

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const result = await response.json()
    console.log('inicis cancellation response:', result)

    if (result.resultCode === '00') {
      return { success: true, message: '결제 취소 성공', data: result }
    } else {
      return { success: false, message: result.resultMsg || '결제 취소 실패', data: result }
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      console.error('inicis cancellation API timeout')
      return { success: false, message: '결제 취소 API 응답 시간 초과' }
    }

    console.error('inicis cancellation API call failed:', error)
    return { success: false, message: '결제 취소 API 호출 실패' }
  }
}

// Fetch order detail (lookup by ID or order number)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params

    // Treat short numeric values (≤8 digits) as IDs; everything else is an order number
    const isId = /^\d+$/.test(id) && id.length <= 8

    const order = await prisma.order.findUnique({
      where: isId ? { id: parseInt(id) } : { orderNo: id },
      include: {
        user: {
          select: { id: true, nickname: true, email: true }
        },
        items: {
          include: {
            product: {
              select: { slug: true, images: true }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // For bank-transfer orders, fetch the account info
    let bankInfo = null
    if (order.paymentMethod === 'bank' && order.status === 'pending') {
      const bankSetting = await prisma.shopSetting.findUnique({
        where: { key: 'bank_info' }
      })
      bankInfo = bankSetting?.value || null
    }

    // Parse card payment info
    let cardInfo = null
    if (order.paymentMethod === 'card' && order.paymentInfo) {
      try {
        const paymentData = JSON.parse(order.paymentInfo)
        cardInfo = {
          cardName: paymentData.cardName || null,  // 카드사 코드
          cardNo: paymentData.cardNo || null,      // 카드 번호 (마스킹됨)
          applNum: paymentData.applNum || null,    // 승인번호
          cardQuota: paymentData.cardQuota || '00', // 할부 개월 (00=일시불)
          applDate: paymentData.applDate || null,  // 승인일자
          applTime: paymentData.applTime || null,   // 승인시간
          tid: paymentData.tid || null             // 거래번호
        }
      } catch {
        cardInfo = null
      }
    }

    // Image processing
    const orderWithImages = {
      ...order,
      items: order.items.map(item => {
        const images = item.product?.images
        let firstImage = null
        if (images) {
          try {
            const parsed = JSON.parse(images)
            firstImage = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null
          } catch {
            firstImage = null
          }
        }
        return {
          ...item,
          productImage: firstImage,
          productSlug: item.product?.slug || null,
          product: undefined
        }
      })
    }

    return NextResponse.json({ order: orderWithImages, bankInfo, cardInfo })
  } catch (error) {
    console.error('failed to fetch order detail:', error)
    return NextResponse.json(
      { error: '주문을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// Update order status (lookup by ID or order number)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const isId = /^\d+$/.test(id) && id.length <= 8
    const body = await request.json()
    const {
      action,
      status,
      trackingCompany,
      trackingNumber,
      adminMemo,
      refundAmount,
    } = body

    const order = await prisma.order.findUnique({
      where: isId ? { id: parseInt(id) } : { orderNo: id },
      include: { items: true }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Approve cancellation request
    if (action === 'cancel_approve') {
      if (order.status !== 'cancel_requested') {
        return NextResponse.json(
          { error: '취소 요청 상태가 아닙니다.' },
          { status: 400 }
        )
      }

      const settings = await getShopSettings()
      let pgCancelResult = null

      // For card payments, cancel the PG approval
      const tid = getPaymentTid(order.paymentInfo)
      if (order.paymentMethod === 'card' && tid) {
        console.log('card payment cancellation attempt (admin approval), tid:', tid)
        pgCancelResult = await cancelInicisPayment(tid, order.cancelReason || '주문 취소', settings)
        console.log('PG cancellation result:', pgCancelResult)

        // In production, return an error when PG cancellation fails
        const testMode = settings.pg_test_mode !== 'false'
        if (!testMode && !pgCancelResult.success) {
          return NextResponse.json(
            { error: `카드 결제 취소 실패: ${pgCancelResult.message}` },
            { status: 400 }
          )
        }
      }

      // Append cancellation info to paymentInfo
      let updatedPaymentInfo = order.paymentInfo
      if (pgCancelResult) {
        try {
          const paymentData = order.paymentInfo ? JSON.parse(order.paymentInfo) : {}
          paymentData.cancelInfo = {
            cancelledAt: new Date().toISOString(),
            cancelReason: order.cancelReason || '주문 취소',
            pgResult: pgCancelResult,
            cancelledBy: 'admin'
          }
          updatedPaymentInfo = JSON.stringify(paymentData)
        } catch {
          // When parsing fails, start with a new object
          updatedPaymentInfo = JSON.stringify({
            cancelInfo: {
              cancelledAt: new Date().toISOString(),
              cancelReason: order.cancelReason || '주문 취소',
              pgResult: pgCancelResult,
              cancelledBy: 'admin'
            }
          })
        }
      }

      // Restore stock and cancel the order
      await prisma.$transaction(async (tx) => {
        // Restore stock
        for (const item of order.items) {
          if (item.optionId) {
            await tx.productOption.update({
              where: { id: item.optionId },
              data: {
                stock: { increment: item.quantity }
              }
            })
          }
          // Decrement sold quantity
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                soldCount: { decrement: item.quantity }
              }
            })
          }
        }

        // Update order status (full refund)
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
            refundAmount: order.totalPrice,
            refundedAt: new Date(),
            paymentInfo: updatedPaymentInfo
          }
        })

        await logActivity(tx, {
          orderId: order.id,
          actorType: 'admin',
          actorId: session.id,
          action: 'cancelled',
          fromStatus: order.status,
          toStatus: 'cancelled',
          payload: {
            reason: order.cancelReason || '주문 취소',
            amount: order.totalPrice,
            cancelledBy: 'admin',
            approvalOfCustomerRequest: true,
          },
          memo: order.cancelReason || null,
        })
      })

      // Create notification
      if (order.userId) {
        await createOrderStatusNotification(order.userId, order.orderNo, order.status, 'cancelled')
      }

      return NextResponse.json({
        success: true,
        message: '취소 요청이 승인되었습니다.',
        pgCancelResult
      })
    }

    // Reject cancellation request (move to shipping)
    if (action === 'cancel_reject') {
      if (order.status !== 'cancel_requested') {
        return NextResponse.json(
          { error: '취소 요청 상태가 아닙니다.' },
          { status: 400 }
        )
      }

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'shipping',
            shippedAt: new Date(),
            cancelReason: null  // 취소 사유 제거
          }
        })
        await logActivity(tx, {
          orderId: order.id,
          actorType: 'admin',
          actorId: session.id,
          action: 'status_changed',
          fromStatus: order.status,
          toStatus: 'shipping',
          payload: { note: '취소 요청 거절' },
        })
      })

      // Create notification (취소 거절 -> 배송중)
      if (order.userId) {
        await createOrderStatusNotification(order.userId, order.orderNo, order.status, 'shipping')
      }

      return NextResponse.json({
        success: true,
        message: '취소 요청이 거절되고 배송중으로 변경되었습니다.'
      })
    }

    // Approve refund request
    if (action === 'refund_approve') {
      if (order.status !== 'refund_requested') {
        return NextResponse.json(
          { error: '환불 요청 상태가 아닙니다.' },
          { status: 400 }
        )
      }

      const settings = await getShopSettings()
      let pgCancelResult = null

      // For card payments, run the PG refund flow
      const tid = getPaymentTid(order.paymentInfo)
      if (order.paymentMethod === 'card' && tid) {
        console.log('card refund attempt (admin approval), tid:', tid)
        pgCancelResult = await cancelInicisPayment(tid, order.cancelReason || '환불 처리', settings)
        console.log('PG refund result:', pgCancelResult)

        // In production, return an error when PG cancellation fails
        const testMode = settings.pg_test_mode !== 'false'
        if (!testMode && !pgCancelResult.success) {
          return NextResponse.json(
            { error: `카드 결제 환불 실패: ${pgCancelResult.message}` },
            { status: 400 }
          )
        }
      }

      // Append refund info to paymentInfo
      let updatedPaymentInfo = order.paymentInfo
      if (pgCancelResult) {
        try {
          const paymentData = order.paymentInfo ? JSON.parse(order.paymentInfo) : {}
          paymentData.refundInfo = {
            refundedAt: new Date().toISOString(),
            refundReason: order.cancelReason || '환불 처리',
            refundAmount: order.refundAmount,
            pgResult: pgCancelResult,
            refundedBy: 'admin'
          }
          updatedPaymentInfo = JSON.stringify(paymentData)
        } catch {
          updatedPaymentInfo = JSON.stringify({
            refundInfo: {
              refundedAt: new Date().toISOString(),
              refundReason: order.cancelReason || '환불 처리',
              refundAmount: order.refundAmount,
              pgResult: pgCancelResult,
              refundedBy: 'admin'
            }
          })
        }
      }

      // Restore stock and process the refund
      await prisma.$transaction(async (tx) => {
        // Restore stock
        for (const item of order.items) {
          if (item.optionId) {
            await tx.productOption.update({
              where: { id: item.optionId },
              data: {
                stock: { increment: item.quantity }
              }
            })
          }
          if (item.productId) {
            await tx.product.update({
            where: { id: item.productId },
            data: {
              soldCount: { decrement: item.quantity }
            }
          })
          }
        }

        // Update order status (refund complete)
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'refunded',
            refundedAt: new Date(),
            paymentInfo: updatedPaymentInfo
          }
        })

        await logActivity(tx, {
          orderId: order.id,
          actorType: 'admin',
          actorId: session.id,
          action: 'refund_issued',
          fromStatus: order.status,
          toStatus: 'refunded',
          payload: {
            amount: order.refundAmount ?? 0,
            reason: order.cancelReason || '환불 처리',
            approvalOfCustomerRequest: true,
          },
          memo: order.cancelReason || null,
        })
      })

      // Create notification
      if (order.userId) {
        await createOrderStatusNotification(order.userId, order.orderNo, order.status, 'refunded')
      }

      return NextResponse.json({
        success: true,
        message: '환불 요청이 승인되었습니다.',
        refundAmount: order.refundAmount,
        pgCancelResult
      })
    }

    // Reject refund request
    if (action === 'refund_reject') {
      if (order.status !== 'refund_requested') {
        return NextResponse.json(
          { error: '환불 요청 상태가 아닙니다.' },
          { status: 400 }
        )
      }

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'delivered',  // 배송완료로 복원
            cancelReason: null,
            refundAmount: null
          }
        })
        await logActivity(tx, {
          orderId: order.id,
          actorType: 'admin',
          actorId: session.id,
          action: 'status_changed',
          fromStatus: order.status,
          toStatus: 'delivered',
          payload: { note: '환불 요청 거절' },
        })
      })

      return NextResponse.json({
        success: true,
        message: '환불 요청이 거절되었습니다.'
      })
    }

    // Admin-initiated order cancellation (unavoidable circumstances)
    if (action === 'admin_cancel') {
      const cancelReason = body.cancelReason

      if (!cancelReason) {
        return NextResponse.json(
          { error: '취소 사유를 입력해주세요.' },
          { status: 400 }
        )
      }

      // Already-cancelled or refunded orders cannot be cancelled again
      if (['cancelled', 'refunded'].includes(order.status)) {
        return NextResponse.json(
          { error: '이미 취소 또는 환불된 주문입니다.' },
          { status: 400 }
        )
      }

      const settings = await getShopSettings()
      let pgCancelResult = null

      // For card payments, cancel the PG approval
      const tid = getPaymentTid(order.paymentInfo)
      if (order.paymentMethod === 'card' && tid) {
        console.log('admin order cancellation — card cancellation attempt, tid:', tid)
        pgCancelResult = await cancelInicisPayment(tid, cancelReason, settings)
        console.log('PG cancellation result:', pgCancelResult)

        // In production, return an error when PG cancellation fails
        const testMode = settings.pg_test_mode !== 'false'
        if (!testMode && !pgCancelResult.success) {
          return NextResponse.json(
            { error: `카드 결제 취소 실패: ${pgCancelResult.message}` },
            { status: 400 }
          )
        }
      }

      // Append cancellation info to paymentInfo
      let updatedPaymentInfo = order.paymentInfo
      if (pgCancelResult) {
        try {
          const paymentData = order.paymentInfo ? JSON.parse(order.paymentInfo) : {}
          paymentData.cancelInfo = {
            cancelledAt: new Date().toISOString(),
            cancelReason: cancelReason,
            pgResult: pgCancelResult,
            cancelledBy: 'admin'
          }
          updatedPaymentInfo = JSON.stringify(paymentData)
        } catch {
          updatedPaymentInfo = JSON.stringify({
            cancelInfo: {
              cancelledAt: new Date().toISOString(),
              cancelReason: cancelReason,
              pgResult: pgCancelResult,
              cancelledBy: 'admin'
            }
          })
        }
      }

      // Restore stock and cancel the order
      await prisma.$transaction(async (tx) => {
        // Restore stock
        for (const item of order.items) {
          if (item.optionId) {
            await tx.productOption.update({
              where: { id: item.optionId },
              data: {
                stock: { increment: item.quantity }
              }
            })
          }
          // Decrement sold quantity
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                soldCount: { decrement: item.quantity }
              }
            })
          }
        }

        // Update order status (full refund)
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'cancelled',
            cancelReason,
            cancelledAt: new Date(),
            refundAmount: order.totalPrice,
            refundedAt: new Date(),
            paymentInfo: updatedPaymentInfo
          }
        })

        await logActivity(tx, {
          orderId: order.id,
          actorType: 'admin',
          actorId: session.id,
          action: 'cancelled',
          fromStatus: order.status,
          toStatus: 'cancelled',
          payload: {
            reason: cancelReason,
            amount: order.totalPrice,
            cancelledBy: 'admin',
          },
          memo: cancelReason,
        })
      })

      // Notify the customer of the admin cancellation (includes the reason)
      if (order.userId) {
        createOrderCancelledByAdminNotification(order.userId, order.orderNo, order.totalPrice, cancelReason)
          .catch(err => console.error('failed to send customer cancellation notification:', err))
      }

      return NextResponse.json({
        success: true,
        message: '주문이 취소되었습니다.',
        pgCancelResult
      })
    }

    // Confirm bank transfer deposit
    if (action === 'confirm_payment') {
      if (order.paymentMethod !== 'bank') {
        return NextResponse.json(
          { error: '무통장입금 주문만 입금확인이 가능합니다.' },
          { status: 400 }
        )
      }

      if (order.status !== 'pending') {
        return NextResponse.json(
          { error: '결제대기 상태에서만 입금확인이 가능합니다.' },
          { status: 400 }
        )
      }

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'paid',
            paidAt: new Date()
          }
        })
        await logActivity(tx, {
          orderId: order.id,
          actorType: 'admin',
          actorId: session.id,
          action: 'status_changed',
          fromStatus: 'pending',
          toStatus: 'paid',
          payload: { note: '무통장입금 확인' },
        })
      })

      // Notify the customer that payment completed
      if (order.userId) {
        await createOrderStatusNotification(order.userId, order.orderNo, 'pending', 'paid')
      }

      return NextResponse.json({
        success: true,
        message: '입금이 확인되었습니다.'
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    // Change status
    if (status && status !== order.status) {
      updateData.status = status

      // Per-status follow-up work
      switch (status) {
        case 'paid':
          updateData.paidAt = new Date()
          break
        case 'shipping':
          updateData.shippedAt = new Date()
          if (trackingCompany) updateData.trackingCompany = trackingCompany
          if (trackingNumber) updateData.trackingNumber = trackingNumber
          break
        case 'delivered':
          updateData.deliveredAt = new Date()
          break
        case 'cancelled':
          updateData.cancelledAt = new Date()

          // Pre-shipping cancellation: full refund
          if (isBeforeShipping(order.status)) {
            updateData.refundAmount = order.totalPrice
            updateData.refundedAt = new Date()

            // Auto-cancel when paid by card
            const tid = getPaymentTid(order.paymentInfo)
            if (order.paymentMethod === 'card' && tid) {
              const settings = await getShopSettings()
              const cancelResult = await cancelInicisPayment(
                tid,
                body.cancelReason || '관리자에 의한 취소',
                settings
              )
              console.log('admin card cancellation result:', cancelResult)
            }
          } else {
            // Post-shipping cancellation: deduct return shipping fee
            const settings = await getShopSettings()
            const returnShippingFee = parseInt(settings.return_shipping_fee || '5000')
            const calculatedRefund = Math.max(0, order.totalPrice - returnShippingFee)
            updateData.refundAmount = refundAmount || calculatedRefund
          }

          // Restore stock
          await restoreStock(order.items)
          break
        case 'refunded':
          updateData.refundedAt = new Date()

          // Compute refund amount
          if (refundAmount) {
            updateData.refundAmount = refundAmount
          } else if (!order.refundAmount) {
            // When no refund amount is provided, deduct the return shipping fee
            const settings = await getShopSettings()
            const returnShippingFee = parseInt(settings.return_shipping_fee || '5000')
            updateData.refundAmount = Math.max(0, order.totalPrice - returnShippingFee)
          }

          // For card payments, process the refund
          const refundTid = getPaymentTid(order.paymentInfo)
          if (order.paymentMethod === 'card' && refundTid) {
            const settings = await getShopSettings()
            const cancelResult = await cancelInicisPayment(
              refundTid,
              body.cancelReason || '관리자에 의한 환불',
              settings
            )
            console.log('admin card refund result:', cancelResult)
          }

          // Restore stock (only if not already restored)
          if (!['cancelled', 'refunded'].includes(order.status)) {
            await restoreStock(order.items)
          }
          break
      }
    }

    // Update shipping info
    if (trackingCompany !== undefined) updateData.trackingCompany = trackingCompany
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber

    // Admin memo
    if (adminMemo !== undefined) updateData.adminMemo = adminMemo

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: updateData
    })

    // Create a notification on status change
    if (status && status !== order.status && order.userId) {
      await createOrderStatusNotification(order.userId, order.orderNo, order.status, status)
    }

    // Audit log: direct status change via PUT (preparing / shipping / delivered / cancelled / refunded ...)
    if (status && status !== order.status) {
      const action = status === 'cancelled' || status === 'refunded'
        ? (status === 'refunded' ? 'refund_issued' : 'cancelled')
        : 'status_changed'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {}
      if (status === 'cancelled' || status === 'refunded') {
        if (body.cancelReason) payload.reason = body.cancelReason
        if (updateData.refundAmount != null) payload.amount = updateData.refundAmount
        payload.cancelledBy = 'admin'
      }
      await logActivity(prisma, {
        orderId: order.id,
        actorType: 'admin',
        actorId: session.id,
        action,
        fromStatus: order.status,
        toStatus: status,
        payload: Object.keys(payload).length > 0 ? payload : undefined,
        memo: body.cancelReason ?? null,
      })
    }

    // Audit log: memo changed
    if (adminMemo !== undefined && adminMemo !== order.adminMemo) {
      await logActivity(prisma, {
        orderId: order.id,
        actorType: 'admin',
        actorId: session.id,
        action: 'memo_updated',
        memo: adminMemo ?? null,
      })
    }

    // Audit log: tracking info changed (when not going through /ship endpoint)
    const trackingChanged =
      (trackingCompany !== undefined && trackingCompany !== order.trackingCompany) ||
      (trackingNumber !== undefined && trackingNumber !== order.trackingNumber)
    if (trackingChanged) {
      await logActivity(prisma, {
        orderId: order.id,
        actorType: 'admin',
        actorId: session.id,
        action: 'tracking_updated',
        payload: {
          trackingCompany: trackingCompany ?? order.trackingCompany,
          trackingNumber: trackingNumber ?? order.trackingNumber,
        },
      })
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder
    })
  } catch (error) {
    console.error('failed to update order status:', error)
    return NextResponse.json(
      { error: '주문 상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Restore stock helper
async function restoreStock(items: { productId: number; optionId: number | null; quantity: number }[]) {
  for (const item of items) {
    if (item.optionId) {
      await prisma.productOption.update({
        where: { id: item.optionId },
        data: {
          stock: { increment: item.quantity }
        }
      })
    }
    if (item.productId) {
      await prisma.product.update({
      where: { id: item.productId },
      data: {
        soldCount: { decrement: item.quantity }
      }
    })
    }
  }
}

// Delete order (soft delete) — lookup by ID or order number
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const isId = /^\d+$/.test(id) && id.length <= 8

    const order = await prisma.order.findUnique({
      where: isId ? { id: parseInt(id) } : { orderNo: id },
      include: { items: true }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Check whether the order is already deleted
    if (order.deletedAt) {
      return NextResponse.json(
        { error: '이미 삭제된 주문입니다.' },
        { status: 400 }
      )
    }

    // 결제 완료 상태에서는 삭제 불가 (환불/취소 후 삭제 가능)
    if (['paid', 'preparing', 'shipping', 'delivered'].includes(order.status)) {
      return NextResponse.json(
        { error: '결제 완료된 주문은 취소/환불 처리 후 삭제할 수 있습니다.' },
        { status: 400 }
      )
    }

    // pending 상태에서 삭제 시 재고 복구 (결제 전이지만 재고가 차감되어 있는 경우)
    // cancelled/refunded 상태는 이미 재고 복구가 되어 있으므로 제외
    if (order.status === 'pending') {
      await restoreStock(order.items)
    }

    // Soft delete (deletedAt 설정)
    await prisma.order.update({
      where: { id: order.id },
      data: { deletedAt: new Date() }
    })

    return NextResponse.json({
      success: true,
      message: '주문이 삭제되었습니다.'
    })
  } catch (error) {
    console.error('주문 삭제 에러:', error)
    return NextResponse.json(
      { error: '주문 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 주문 복원 - ID 또는 주문번호로 조회 가능
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const isId = /^\d+$/.test(id) && id.length <= 8
    const body = await request.json()
    const { action } = body

    if (action !== 'restore') {
      return NextResponse.json(
        { error: '지원하지 않는 작업입니다.' },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: isId ? { id: parseInt(id) } : { orderNo: id }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 삭제되지 않은 주문인지 확인
    if (!order.deletedAt) {
      return NextResponse.json(
        { error: '삭제되지 않은 주문입니다.' },
        { status: 400 }
      )
    }

    // 복원 (deletedAt을 null로 설정)
    await prisma.order.update({
      where: { id: order.id },
      data: { deletedAt: null }
    })

    return NextResponse.json({
      success: true,
      message: '주문이 복원되었습니다.'
    })
  } catch (error) {
    console.error('주문 복원 에러:', error)
    return NextResponse.json(
      { error: '주문 복원 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
