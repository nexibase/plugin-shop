import type { NotificationPayload } from '../send'

export default function template(payload: NotificationPayload) {
  const id = payload.data.returnRequestId ?? ''
  const title = `반품 상품 회수 완료 #${id}`
  const body = `반품 상품이 회수되었습니다. 환불 또는 교환 처리가 곧 진행됩니다.`
  return {
    title,
    body,
    subject: title,
    html: `<p>${body}</p><p><a href="/mypage/returns/${id}">요청 내역 확인</a></p>`,
  }
}
