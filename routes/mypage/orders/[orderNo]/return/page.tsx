"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface OrderItem { id: number; productName: string; optionText: string | null; quantity: number; price: number }
interface Order { orderNo: string; items: OrderItem[]; status: string; deliveredAt: string | null }

const REASONS = [
  { value: 'defective', label: '상품 불량' },
  { value: 'damaged_shipping', label: '배송 중 파손' },
  { value: 'wrong_item', label: '다른 상품 배송' },
  { value: 'change_of_mind', label: '단순 변심' },
  { value: 'other', label: '기타' },
]

export default function ReturnRequestForm() {
  const { orderNo } = useParams<{ orderNo: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [type, setType] = useState<'return' | 'exchange'>('return')
  const [reason, setReason] = useState('defective')
  const [reasonDetail, setReasonDetail] = useState('')
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({})
  const [photos, setPhotos] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/shop/orders/${orderNo}`).then(r => r.json()).then(d => {
      const ord: Order = d.order ?? d
      setOrder(ord)
      const qs: Record<number, number> = {}
      ord?.items?.forEach((it) => { qs[it.id] = 0 })
      setItemQuantities(qs)
    })
  }, [orderNo])

  const uploadPhoto = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (res.ok) {
      const d = await res.json()
      setPhotos(prev => [...prev, d.url])
    }
  }

  const submit = async () => {
    const items = Object.entries(itemQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId: Number(orderItemId), quantity }))
    if (items.length === 0) { alert('반품할 항목을 선택해주세요'); return }
    setSubmitting(true)
    const res = await fetch('/api/shop/returns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNo, type, reason, reasonDetail, photos, items }),
    })
    setSubmitting(false)
    if (res.ok) {
      const d = await res.json()
      router.push(`/shop/mypage/returns/${d.request.id}`)
    } else {
      alert((await res.json()).error ?? '요청 실패')
    }
  }

  if (!order) return <MyPageLayout><div className="p-6">로딩...</div></MyPageLayout>

  return (
    <MyPageLayout>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">교환/반품 신청 — 주문 {order.orderNo}</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">유형</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant={type === 'return' ? 'default' : 'outline'} onClick={() => setType('return')}>반품</Button>
              <Button variant={type === 'exchange' ? 'default' : 'outline'} onClick={() => setType('exchange')}>교환 (불량 동일상품 재발송)</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">항목 선택</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {order.items.map(it => (
              <div key={it.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="flex-1">
                  <div className="text-sm font-medium">{it.productName}</div>
                  {it.optionText && <div className="text-xs text-muted-foreground">{it.optionText}</div>}
                  <div className="text-xs text-muted-foreground">주문 수량 {it.quantity}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">수량:</Label>
                  <Input type="number" min={0} max={it.quantity}
                    value={itemQuantities[it.id] ?? 0}
                    onChange={e => setItemQuantities(q => ({ ...q, [it.id]: Math.min(it.quantity, Math.max(0, Number(e.target.value) || 0)) }))}
                    className="w-20" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">사유</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>사유 카테고리</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>상세 사유</Label>
              <Textarea value={reasonDetail} onChange={e => setReasonDetail(e.target.value)} rows={4} />
            </div>
            <div>
              <Label>사진 첨부 (선택)</Label>
              <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }} />
              <div className="flex gap-2 mt-2 flex-wrap">
                {photos.map((url, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-20 h-20 object-cover rounded" />
                    <button type="button" onClick={() => setPhotos(p => p.filter((_, idx) => idx !== i))}
                      className="absolute top-0 right-0 bg-black/60 text-white rounded-bl px-1 text-xs">×</button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()}>취소</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? '제출 중...' : '신청'}</Button>
        </div>
      </div>
    </MyPageLayout>
  )
}
