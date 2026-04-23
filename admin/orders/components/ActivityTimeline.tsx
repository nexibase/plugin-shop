"use client"
import { useEffect, useState } from "react"
import { format } from "date-fns"

interface Activity {
  id: number
  actorType: string
  actorId: number | null
  action: string
  fromStatus: string | null
  toStatus: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
  memo: string | null
  createdAt: string
}

const ACTION_LABEL: Record<string, string> = {
  order_created: '주문 생성',
  payment_succeeded: '결제 완료',
  payment_failed: '결제 실패',
  status_changed: '상태 변경',
  tracking_updated: '송장 입력',
  memo_updated: '관리자 메모 수정',
  cancel_requested: '취소 요청',
  cancelled: '주문 취소',
  refund_issued: '환불 처리',
  exchange_sent: '교환 발송',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '결제대기',
  paid: '결제완료',
  preparing: '배송준비',
  shipping: '배송중',
  delivered: '배송완료',
  confirmed: '구매확정',
  cancel_requested: '취소요청',
  cancelled: '취소완료',
  refund_requested: '환불요청',
  refunded: '환불완료',
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return ''
  return n.toLocaleString('ko-KR') + '원'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarizePayload(action: string, payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null
  switch (action) {
    case 'payment_succeeded':
      if (payload.amount != null) {
        const method = payload.method ? ` · ${payload.method}` : ''
        return `${fmtMoney(payload.amount)}${method}`
      }
      return null
    case 'payment_failed':
      return payload.error ? `실패 사유: ${payload.error}` : null
    case 'tracking_updated':
      if (payload.trackingCompany || payload.trackingNumber) {
        return `${payload.trackingCompany ?? ''} ${payload.trackingNumber ?? ''}`.trim()
      }
      return null
    case 'cancelled':
      if (payload.reason) return `사유: ${payload.reason}`
      return null
    case 'refund_issued': {
      const parts: string[] = []
      if (payload.amount != null) parts.push(`환불 ${fmtMoney(payload.amount)}`)
      if (payload.cumulativeRefund != null && payload.cumulativeRefund !== payload.amount) {
        parts.push(`누적 ${fmtMoney(payload.cumulativeRefund)}`)
      }
      if (payload.isFullRefund) parts.push('전액 환불')
      if (payload.reason) parts.push(`사유: ${payload.reason}`)
      return parts.length > 0 ? parts.join(' · ') : null
    }
    case 'exchange_sent': {
      const parts: string[] = []
      if (payload.totalQty != null) parts.push(`${payload.totalQty}개`)
      if (payload.replacementOrderNo) parts.push(`주문번호 ${payload.replacementOrderNo}`)
      return parts.length > 0 ? parts.join(' · ') : null
    }
    default:
      return null
  }
}

function actorLabel(a: Activity): string {
  if (a.actorType === 'system') return '시스템'
  if (a.actorType === 'admin') return a.actorId ? `관리자 #${a.actorId}` : '관리자'
  return a.actorId ? `고객 #${a.actorId}` : '고객'
}

export function ActivityTimeline({ orderId }: { orderId: number }) {
  const [items, setItems] = useState<Activity[]>([])
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/shop/orders/${orderId}/activities`)
      .then(r => r.json())
      .then(d => setItems(d.activities ?? []))
  }, [orderId])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">활동 이력</h3>
        <button
          type="button"
          onClick={() => setShowRaw(v => !v)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showRaw ? '간단히 보기' : '상세 데이터'}
        </button>
      </div>
      <ol className="relative border-l border-border pl-4 space-y-3">
        {items.map(a => {
          const summary = summarizePayload(a.action, a.payload)
          return (
            <li key={a.id} className="relative">
              <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
              <time className="text-xs text-muted-foreground">
                {format(new Date(a.createdAt), 'yyyy-MM-dd HH:mm')}
              </time>
              <div className="text-sm">
                <span className="font-medium">{ACTION_LABEL[a.action] ?? a.action}</span>
                {a.fromStatus && a.toStatus && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {STATUS_LABEL[a.fromStatus] ?? a.fromStatus} → {STATUS_LABEL[a.toStatus] ?? a.toStatus}
                  </span>
                )}
              </div>
              {summary && <div className="text-xs text-muted-foreground">{summary}</div>}
              <div className="text-[11px] text-muted-foreground">{actorLabel(a)}</div>
              {a.memo && !summary?.includes(a.memo) && (
                <div className="text-xs italic mt-1">&ldquo;{a.memo}&rdquo;</div>
              )}
              {showRaw && a.payload && (
                <pre className="text-[10px] bg-muted/40 p-1 rounded mt-1 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(a.payload, null, 2)}
                </pre>
              )}
            </li>
          )
        })}
        {items.length === 0 && (
          <li className="text-xs text-muted-foreground">이력이 없습니다.</li>
        )}
      </ol>
    </div>
  )
}
