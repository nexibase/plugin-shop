"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface OrderItem {
  id: number
  productName: string
  optionText: string | null
  quantity: number
}

interface Props {
  open: boolean
  onClose: () => void
  orderId: number
  orderNo: string
  items: OrderItem[]
  onExchanged: () => void
}

export function ExchangeDialog({ open, onClose, orderId, orderNo, items, onExchanged }: Props) {
  const [qty, setQty] = useState<Record<number, number>>({})
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setQty({})
      setMemo('')
    }
  }, [open])

  const submit = async () => {
    const payload = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => ({ orderItemId: Number(id), quantity: q }))
    if (payload.length === 0) { alert('교환할 항목을 선택해 주세요'); return }
    if (!confirm('교환 발송 주문을 생성하시겠습니까?')) return
    setSubmitting(true)
    const res = await fetch(`/api/admin/shop/orders/${orderId}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payload, memo }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { alert(data.error || '교환 실패'); return }
    alert(`교환 발송 주문 생성됨: ${data.replacementOrderNo}\n배송준비 상태로 시작됩니다. 해당 주문에서 송장을 입력하면 배송이 진행됩니다.`)
    onExchanged()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>교환 발송</DialogTitle>
          <DialogDescription>
            주문 {orderNo} — 동일 상품을 무료로 재발송하는 새 주문을 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 space-y-1">
            <div>• 교환 주문은 <strong>무료(결제액 0원)</strong>로 생성되고 <strong>배송준비</strong> 상태로 시작됩니다.</div>
            <div>• 환불은 별도로 일어나지 않습니다. (옵션 변경이면 환불+재주문을 권장)</div>
            <div>• 원주문 상품의 재고는 자동 복구되지 않습니다. 수동 조정.</div>
          </div>

          <div>
            <Label>교환할 항목 × 수량</Label>
            <div className="space-y-2 mt-1">
              {items.map(it => (
                <div key={it.id} className="flex items-center gap-2 py-2 border-b last:border-0">
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{it.productName}</div>
                    {it.optionText && <div className="text-xs text-muted-foreground">{it.optionText}</div>}
                    <div className="text-xs text-muted-foreground">주문 수량 {it.quantity}</div>
                  </div>
                  <Input type="number" min={0} max={it.quantity}
                    value={qty[it.id] ?? 0}
                    onChange={e => setQty(q => ({ ...q, [it.id]: Math.min(it.quantity, Math.max(0, Number(e.target.value) || 0)) }))}
                    className="w-16 h-8 text-sm" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="exchange-memo">메모 (선택)</Label>
            <Textarea id="exchange-memo" value={memo} onChange={e => setMemo(e.target.value)} rows={2}
              placeholder="교환 사유 / 고객 안내 내용 등" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? '생성 중...' : '교환 주문 생성'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
