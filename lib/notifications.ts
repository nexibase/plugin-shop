import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { emitNotification, registerNotificationEvent } from '@/lib/notifications/service'
import { renderOrderCompletedEmail, renderOrderStatusEmail, renderNewOrderEmailToAdmin, renderOrderCancelledEmail, renderOrderCancelledEmailToAdmin } from './notification-emails'

export const SHOP_NOTIFICATION_EVENTS = {
  'shop.order_completed': '주문 접수 · 구매자', 'shop.order_status': '주문 상태 변경 · 구매자',
  'shop.order_cancelled': '주문 취소 · 구매자', 'shop.new_order_admin': '새 주문 · 관리자',
  'shop.order_cancelled_admin': '주문 취소 · 관리자', 'shop.order_request_admin': '취소·환불 요청 · 관리자',
} as const
export async function registerShopNotificationEvents(db: Prisma.TransactionClient = prisma) {
  const old = await db.shopSetting.findUnique({ where: { key: 'email_notification_enabled' } })
  for (const [eventType, label] of Object.entries(SHOP_NOTIFICATION_EVENTS)) {
    await registerNotificationEvent({ eventType, label, preferenceType: 'order_status', owner: 'shop', emailEnabled: eventType !== 'shop.order_request_admin' && old?.value === 'true' }, db)
  }
}
const labels: Record<string, string> = { pending: '결제 대기', paid: '결제 완료', preparing: '배송 준비중', shipping: '배송중', delivered: '배송 완료', cancelled: '주문 취소', cancel_requested: '취소 요청', refund_requested: '환불 요청', refunded: '환불 완료' }
async function orderEvent(userId: number, orderNo: string, type: keyof typeof SHOP_NOTIFICATION_EVENTS,
  title: string, message: string, options: { key?: string; admin?: boolean; email?: { subject: string; html: string }; variables?: Record<string, string>; db?: Prisma.TransactionClient } = {}) {
  const db = options.db || prisma
  const order = await db.order.findUnique({ where: { orderNo }, select: { id: true, updatedAt: true, status: true, finalPrice: true, ordererName: true, trackingNumber: true } })
  // OrderActivity is the source action identity, including repeated transitions back into the same state.
  const activity = order ? await db.orderActivity.findFirst({ where: { orderId: order.id }, orderBy: { id: 'desc' }, select: { id: true } }) : null
  return emitNotification({ userId, type, title, message: `[주문번호: ${orderNo}] ${message}`,
    link: options.admin ? `/admin/shop/orders/${orderNo}` : `/shop/orders/${orderNo}`,
    eventKey: `${orderNo}:${options.key || activity?.id || order?.updatedAt.toISOString() || 'initial'}`,
    definition: { eventType: type, label: SHOP_NOTIFICATION_EVENTS[type], preferenceType: 'order_status', owner: 'shop', emailEnabled: false },
    email: options.email, variables: { orderNo, status: labels[order?.status || ''] || order?.status || '',
      totalAmount: String(order?.finalPrice || 0), customerName: order?.ordererName || '', trackingNumber: order?.trackingNumber || '', ...options.variables },
  }, db)
}
export async function createOrderStatusNotification(userId: number, orderNo: string, oldStatus: string, newStatus: string, trackingNumber?: string, db: Prisma.TransactionClient = prisma) {
  await registerShopNotificationEvents(db)
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, nickname: true } })
  const email = user ? await renderOrderStatusEmail(user.email, user.nickname, orderNo, newStatus, trackingNumber) : undefined
  return orderEvent(userId, orderNo, 'shop.order_status', `주문 상태 변경: ${labels[newStatus] || newStatus}`,
    `주문 상태가 ${labels[newStatus] || newStatus}(으)로 변경되었습니다.${trackingNumber ? ` 운송장: ${trackingNumber}` : ''}`,
    { db, email, variables: { status: labels[newStatus] || newStatus, trackingNumber: trackingNumber || '' } })
}
export async function createOrderCompletedNotification(userId: number, orderNo: string, totalAmount: number, items?: { name: string; quantity: number; price: number }[], db: Prisma.TransactionClient = prisma) {
  await registerShopNotificationEvents(db)
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, nickname: true, name: true } })
  const email = user && items ? await renderOrderCompletedEmail(user.email, user.name || user.nickname, orderNo, totalAmount, items) : undefined
  return orderEvent(userId, orderNo, 'shop.order_completed', '🛒 주문이 완료되었습니다', `${totalAmount.toLocaleString()}원 주문이 접수되었습니다.`, { db, key: 'completed', email })
}
export async function createOrderCancelledNotification(userId: number, orderNo: string, refundAmount: number, cancelReason?: string, db: Prisma.TransactionClient = prisma) {
  await registerShopNotificationEvents(db)
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, nickname: true, name: true } })
  const email = user ? await renderOrderCancelledEmail(user.email, user.name || user.nickname, orderNo, refundAmount, cancelReason || '') : undefined
  return orderEvent(userId, orderNo, 'shop.order_cancelled', '❌ 주문이 취소되었습니다', `주문이 취소되고 ${refundAmount.toLocaleString()}원이 환불 처리됩니다.${cancelReason ? ` 사유: ${cancelReason}` : ''}`, { db, email })
}
export async function createOrderCancelledByAdminNotification(userId: number, orderNo: string, refundAmount: number, cancelReason: string, db: Prisma.TransactionClient = prisma) {
  return createOrderCancelledNotification(userId, orderNo, refundAmount, `관리자 취소: ${cancelReason}`, db)
}
async function admins(db: Prisma.TransactionClient = prisma) {
  const setting = await db.shopSetting.findUnique({ where: { key: 'order_notification_target' } })
  const target = setting?.value || 'admin'
  const roles = target === 'none' ? [] : target === 'both' ? ['admin', 'manager'] : target === 'manager' ? ['manager'] : ['admin']
  return db.user.findMany({ where: { role: { in: roles }, status: 'active', deletedAt: null }, select: { id: true, email: true } })
}
export async function createNewOrderNotificationForAdmins(_orderId: number, orderNo: string, totalAmount: number, customerName: string, db: Prisma.TransactionClient = prisma) {
  await registerShopNotificationEvents(db)
  return Promise.all((await admins(db)).map(async admin => orderEvent(admin.id, orderNo, 'shop.new_order_admin', '🛒 새 주문이 접수되었습니다',
    `${customerName}님이 ${totalAmount.toLocaleString()}원 주문을 접수했습니다.`, { db, admin: true, key: 'completed', email: await renderNewOrderEmailToAdmin(admin.email, orderNo, customerName, totalAmount) })))
}
export async function createOrderCancelledNotificationForAdmins(orderNo: string, customerName: string, refundAmount: number, cancelReason?: string, db: Prisma.TransactionClient = prisma) {
  await registerShopNotificationEvents(db)
  return Promise.all((await admins(db)).map(async admin => orderEvent(admin.id, orderNo, 'shop.order_cancelled_admin', '❌ 주문이 취소되었습니다',
    `${customerName}님의 주문이 취소되었습니다. 환불금액: ${refundAmount.toLocaleString()}원`, { db, admin: true,
      email: await renderOrderCancelledEmailToAdmin(admin.email, orderNo, customerName, refundAmount, cancelReason || '') })))
}
export async function createCancelRequestNotificationForAdmins(orderNo: string, customerName: string, requestType: 'cancel' | 'refund', db: Prisma.TransactionClient = prisma) {
  await registerShopNotificationEvents(db)
  const kind = requestType === 'cancel' ? '취소' : '환불'
  return Promise.all((await admins(db)).map(admin => orderEvent(admin.id, orderNo, 'shop.order_request_admin', `⚠️ ${kind} 요청이 접수되었습니다`,
    `${customerName}님이 ${kind}를 요청했습니다. 확인이 필요합니다.`, { db, admin: true })))
}
