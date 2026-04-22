"use client"
import { Button } from "@/components/ui/button"
import { allowedTransitions, type OrderStatus } from "@/plugins/shop/fulfillment/state-machine"

interface Props {
  orderId: number
  status: OrderStatus
  onChanged: () => void
}

const LABEL: Record<OrderStatus, string> = {
  pending: '결제대기', paid: '결제완료', preparing: '배송준비',
  shipping: '배송중', delivered: '배송완료', confirmed: '구매확정',
  cancel_requested: '취소요청', cancelled: '취소완료',
}

export function StatusTransitionBar({ orderId, status, onChanged }: Props) {
  const next = allowedTransitions(status)

  const transition = async (to: OrderStatus) => {
    const map: Partial<Record<OrderStatus, string>> = {
      preparing: `/api/admin/shop/orders/${orderId}/prepare`,
      shipping: `/api/admin/shop/orders/${orderId}/ship`,
      delivered: `/api/admin/shop/orders/${orderId}/deliver`,
      cancelled: `/api/admin/shop/orders/${orderId}/cancel`,
    }
    const endpoint = map[to]
    if (!endpoint) {
      alert(`${to} 전이는 아직 지원되지 않습니다`)
      return
    }
    if (to === 'shipping') {
      const company = window.prompt('택배사 (예: CJ대한통운)')
      if (!company) return
      const number = window.prompt('송장번호')
      if (!number) return
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackingCompany: company, trackingNumber: number }) })
      if (!res.ok) alert((await res.json()).error ?? '요청 실패')
    } else if (to === 'cancelled') {
      const reason = window.prompt('취소 사유')
      if (reason === null) return
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
      if (!res.ok) alert((await res.json()).error ?? '요청 실패')
    } else {
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) alert((await res.json()).error ?? '요청 실패')
    }
    onChanged()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium px-3 py-1 rounded bg-muted">{LABEL[status]}</span>
      {next.map(to => (
        <Button key={to} variant="outline" size="sm" onClick={() => transition(to)}>
          → {LABEL[to]}
        </Button>
      ))}
    </div>
  )
}
