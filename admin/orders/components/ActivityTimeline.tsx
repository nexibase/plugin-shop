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
  payload: any
  memo: string | null
  createdAt: string
}

const ACTION_LABEL_KO: Record<string, string> = {
  order_created: '주문 생성',
  payment_succeeded: '결제 완료',
  payment_failed: '결제 실패',
  status_changed: '상태 변경',
  tracking_updated: '송장 업데이트',
  memo_updated: '관리자 메모 변경',
  cancel_requested: '취소 요청',
  cancelled: '취소 완료',
  refund_issued: '환불 처리',
}

export function ActivityTimeline({ orderId }: { orderId: number }) {
  const [items, setItems] = useState<Activity[]>([])

  useEffect(() => {
    fetch(`/api/admin/shop/orders/${orderId}/activities`)
      .then(r => r.json())
      .then(d => setItems(d.activities ?? []))
  }, [orderId])

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">활동 이력</h3>
      <ol className="relative border-l border-border pl-4 space-y-4">
        {items.map(a => (
          <li key={a.id} className="relative">
            <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-primary" />
            <time className="text-xs text-muted-foreground">
              {format(new Date(a.createdAt), 'yyyy-MM-dd HH:mm:ss')}
            </time>
            <div className="text-sm font-medium">
              {ACTION_LABEL_KO[a.action] ?? a.action}
              {a.fromStatus && a.toStatus && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {a.fromStatus} → {a.toStatus}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {a.actorType === 'system' ? '시스템' : a.actorType === 'admin' ? `관리자#${a.actorId}` : `고객#${a.actorId}`}
            </div>
            {a.memo && <div className="text-xs italic mt-1">{a.memo}</div>}
            {a.payload && (
              <pre className="text-[10px] bg-muted/40 p-1 rounded mt-1 overflow-x-auto">
                {JSON.stringify(a.payload)}
              </pre>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-xs text-muted-foreground">이력이 없습니다.</li>
        )}
      </ol>
    </div>
  )
}
