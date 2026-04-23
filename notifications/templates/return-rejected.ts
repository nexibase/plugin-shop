import type { NotificationPayload } from '../send'

export default function template(payload: NotificationPayload) {
  const id = payload.data.returnRequestId ?? ''
  const rejectReason = payload.data.rejectReason ?? '사유 없음'
  const title = `반품/교환 요청 #${id} 거절됨`
  const body = `반품/교환 요청이 거절되었습니다. 사유: ${rejectReason}`
  return {
    title,
    body,
    subject: title,
    html: `<p>${body}</p><p><a href="/mypage/returns/${id}">요청 내역 확인</a></p>`,
  }
}
