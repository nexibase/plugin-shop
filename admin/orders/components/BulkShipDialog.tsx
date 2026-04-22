"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
  open: boolean
  onClose: () => void
  selectedOrderIds: number[]
  onDone: () => void
}

export function BulkShipDialog({ open, onClose, selectedOrderIds, onDone }: Props) {
  const [rows, setRows] = useState<Record<number, { company: string; number: string }>>({})
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ orderId: number; error: string }[]>([])

  const submit = async () => {
    setSubmitting(true)
    const items = Object.entries(rows)
      .map(([id, v]) => ({ orderId: Number(id), trackingCompany: v.company, trackingNumber: v.number }))
      .filter(r => r.trackingCompany && r.trackingNumber)
    const res = await fetch('/api/admin/shop/orders/bulk-ship', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    const data = await res.json()
    setSubmitting(false)
    const failed = (data.results ?? []).filter((r: { ok: boolean }) => !r.ok)
    if (failed.length === 0) { onDone(); onClose() }
    else setErrors(failed)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>일괄 송장입력 ({selectedOrderIds.length}건)</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {selectedOrderIds.map(id => (
            <div key={id} className="flex items-center gap-2">
              <span className="text-sm w-20">#{id}</span>
              <Input placeholder="택배사" onChange={e => setRows(r => ({ ...r, [id]: { ...(r[id] ?? { company: '', number: '' }), company: e.target.value } }))} />
              <Input placeholder="송장번호" onChange={e => setRows(r => ({ ...r, [id]: { ...(r[id] ?? { company: '', number: '' }), number: e.target.value } }))} />
            </div>
          ))}
          {errors.length > 0 && (
            <div className="text-sm text-red-600">
              {errors.map(e => <div key={e.orderId}>#{e.orderId}: {e.error}</div>)}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
            <Button onClick={submit} disabled={submitting}>{submitting ? '처리 중...' : '저장'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
