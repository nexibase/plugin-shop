import type { NotificationPayload } from '../send'

export default function template(payload: NotificationPayload) {
  const id = payload.data.returnRequestId ?? ''
  const replacementOrderNo = payload.data.replacementOrderNo ?? ''
  const title = `교환 상품 발송 준비 완료 #${id}`
  const body = `교환 요청이 완료되어 새 주문(${replacementOrderNo})이 준비 중입니다.`
  return {
    title,
    body,
    subject: title,
    html: `<p>${body}</p><p><a href="/shop/orders/${replacementOrderNo}">새 주문 확인</a></p>`,
  }
}
