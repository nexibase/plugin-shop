"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  open: boolean
  onClose: () => void
  orderId: number
  orderNo: string
  finalPrice: number
  alreadyRefunded: number
  paymentGateway: string | null
  onRefunded: () => void
}

export function RefundDialog({ open, onClose, orderId, orderNo, finalPrice, alreadyRefunded, paymentGateway, onRefunded }: Props) {
  const refundable = finalPrice - alreadyRefunded
  const [amount, setAmount] = useState<string>(String(refundable))
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount(String(refundable))
      setReason('')
    }
  }, [open, refundable])

  const submit = async () => {
    const n = Number(amount)
    if (!n || n <= 0) { alert('금액을 입력해 주세요'); return }
    if (n > refundable) { alert(`환불 가능 금액은 ${refundable.toLocaleString()}원입니다`); return }
    if (!confirm(`${n.toLocaleString()}원을 환불하시겠습니까?`)) return
    setSubmitting(true)
    const res = await fetch(`/api/admin/shop/orders/${orderId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: n, reason }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { alert(data.error || '환불 실패'); return }
    alert(`환불 완료: ${data.amount.toLocaleString()}원${data.isFullRefund ? ' (전액 환불)' : ''}`)
    onRefunded()
    onClose()
  }

  const noPg = !paymentGateway || paymentGateway === 'bank_deposit'

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>환불 처리</DialogTitle>
          <DialogDescription>
            주문 {orderNo} — 환불 가능 금액: {refundable.toLocaleString()}원
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {noPg && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              ⚠ PG 결제(이니시스)가 아닙니다. 시스템은 금액만 기록합니다. 실제 환불은 관리자가 수동(계좌이체 등)으로 처리해야 합니다.
            </div>
          )}

          <div>
            <Label htmlFor="refund-amount">환불 금액</Label>
            <Input
              id="refund-amount"
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min={1}
              max={refundable}
            />
            <p className="text-xs text-muted-foreground mt-1">
              결제액 {finalPrice.toLocaleString()}원{alreadyRefunded > 0 && `, 이미 환불 ${alreadyRefunded.toLocaleString()}원`}
            </p>
          </div>

          <div>
            <Label htmlFor="refund-reason">사유 (선택)</Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="취소 / 반품 / 부분 환불 사유 등"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
            <Button onClick={submit} disabled={submitting || !amount}>
              {submitting ? '처리 중...' : '환불'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
