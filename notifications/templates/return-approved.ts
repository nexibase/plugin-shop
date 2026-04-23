import type { NotificationPayload } from '../send'

export default function template(payload: NotificationPayload) {
  const id = payload.data.returnRequestId ?? ''
  const customerBearsShipping = payload.data.customerBearsShipping
  const shippingNote = customerBearsShipping
    ? '반품 배송비는 고객 부담입니다.'
    : '반품 배송비는 판매자 부담입니다.'
  const title = `반품/교환 요청 #${id} 승인됨`
  const body = `반품/교환 요청이 승인되었습니다. ${shippingNote} 상품을 반송해 주세요.`
  return {
    title,
    body,
    subject: title,
    html: `<p>${body}</p><p><a href="/mypage/returns/${id}">요청 내역 확인</a></p>`,
  }
}
