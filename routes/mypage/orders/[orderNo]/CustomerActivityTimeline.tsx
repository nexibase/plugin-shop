"use client"
import { useEffect, useState } from "react"

interface Activity {
  id: number
  actorType: string
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
      return payload.amount != null ? fmtMoney(payload.amount) : null
    case 'tracking_updated':
      if (payload.trackingCompany || payload.trackingNumber) {
        return `${payload.trackingCompany ?? ''} ${payload.trackingNumber ?? ''}`.trim()
      }
      return null
    case 'cancelled':
      return payload.reason ? `사유: ${payload.reason}` : null
    case 'refund_issued': {
      const parts: string[] = []
      if (payload.amount != null) parts.push(`환불 ${fmtMoney(payload.amount)}`)
      if (payload.reason) parts.push(`사유: ${payload.reason}`)
      return parts.length > 0 ? parts.join(' · ') : null
    }
    case 'cancel_requested':
      return payload.reason ? `사유: ${payload.reason}` : null
    case 'status_changed':
      return payload.reason || payload.note || null
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
  if (a.actorType === 'admin') return '관리자'
  if (a.actorType === 'customer') return '고객'
  return '시스템'
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

export function CustomerActivityTimeline({ orderNo }: { orderNo: string }) {
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/shop/orders/${orderNo}/activities`)
      .then((r) => (r.ok ? r.json() : { activities: [] }))
      .then((d) => setItems(d.activities ?? []))
      .finally(() => setLoading(false))
  }, [orderNo])

  if (loading) return null
  if (items.length === 0) return null

  return (
    <ol className="relative border-l border-border pl-4 space-y-3">
      {items.map((a) => {
        const summary = summarizePayload(a.action, a.payload)
        return (
          <li key={a.id} className="relative">
            <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
            <time className="text-xs text-muted-foreground">
              {formatDateTime(a.createdAt)}
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
          </li>
        )
      })}
    </ol>
  )
}
