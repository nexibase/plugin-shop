import type { NotificationPayload } from '../send'

export default function template(payload: NotificationPayload) {
  const id = payload.data.returnRequestId ?? ''
  const amount = typeof payload.data.amount === 'number'
    ? `${(payload.data.amount as number).toLocaleString()}원`
    : `${payload.data.amount ?? ''}원`
  const title = `환불 처리 완료 #${id}`
  const body = `${amount} 환불이 완료되었습니다. 카드사에 따라 3~5 영업일 내 반영됩니다.`
  return {
    title,
    body,
    subject: title,
    html: `<p>${body}</p><p><a href="/mypage/returns/${id}">요청 내역 확인</a></p>`,
  }
}
