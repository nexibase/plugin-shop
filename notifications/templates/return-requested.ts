import type { NotificationPayload } from '../send'

export default function template(payload: NotificationPayload) {
  const id = payload.data.returnRequestId ?? ''
  const orderNo = payload.data.orderNo ?? ''
  const type = payload.data.type === 'exchange' ? '교환' : '반품'
  const title = `새 ${type} 요청 #${id}`
  const body = `주문 ${orderNo}에 대해 ${type} 요청이 접수되었습니다.`
  return {
    title,
    body,
    subject: title,
    html: `<p>${body}</p><p><a href="/admin/shop/returns/${id}">요청 확인</a></p>`,
  }
}
