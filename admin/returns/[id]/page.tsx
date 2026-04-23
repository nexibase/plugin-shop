"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { allowedReturnTransitions, type ReturnStatus } from "@/plugins/shop/fulfillment/return-state-machine"

const STATUS_LABEL: Record<string, string> = {
  requested: '요청', approved: '승인', rejected: '반려', collected: '수취완료', completed: '완료',
}

export default function AdminReturnDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<any>(null)
  const load = () => fetch(`/api/admin/shop/returns/${id}`).then(r => r.json()).then(d => setData(d.request))
  useEffect(() => { load() }, [id])
  if (!data) return <div className="flex min-h-screen"><Sidebar /><main className="flex-1 p-6">로딩...</main></div>

  const approve = async () => {
    const bear = window.confirm('반품 배송비를 고객이 부담합니까? (OK=고객부담 / Cancel=판매자부담)')
    const memo = window.prompt('관리자 메모 (선택)')
    const r = await fetch(`/api/admin/shop/returns/${id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerBearsShipping: bear, adminMemo: memo }),
    })
    if (r.ok) load(); else alert((await r.json()).error)
  }
  const reject = async () => {
    const reason = window.prompt('반려 사유')
    if (reason === null) return
    const r = await fetch(`/api/admin/shop/returns/${id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rejectReason: reason }),
    })
    if (r.ok) load(); else alert((await r.json()).error)
  }
  const collect = async () => {
    const r = await fetch(`/api/admin/shop/returns/${id}/collect`, { method: 'POST' })
    if (r.ok) load(); else alert((await r.json()).error)
  }
  const refund = async () => {
    if (!confirm('환불을 실행하시겠습니까?')) return
    const r = await fetch(`/api/admin/shop/returns/${id}/refund`, { method: 'POST' })
    if (r.ok) load(); else alert((await r.json()).error)
  }
  const createExchangeOrder = async () => {
    if (!confirm('교환 발송 주문을 생성하시겠습니까?')) return
    const r = await fetch(`/api/admin/shop/returns/${id}/exchange-order`, { method: 'POST' })
    if (r.ok) { const d = await r.json(); alert(`신규 주문: ${d.replacementOrderNo}`); load() }
    else alert((await r.json()).error)
  }

  const next = allowedReturnTransitions(data.status as ReturnStatus)

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <h1 className="text-xl font-semibold">교환/반품 #{data.id}</h1>

          <Card>
            <CardHeader><CardTitle className="text-base">상태 / 액션</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p>현재 상태: <strong>{STATUS_LABEL[data.status]}</strong></p>
              <div className="flex flex-wrap gap-2">
                {next.includes('approved') && <Button onClick={approve}>승인</Button>}
                {next.includes('rejected') && <Button variant="destructive" onClick={reject}>반려</Button>}
                {next.includes('collected') && <Button onClick={collect}>수취확인</Button>}
                {data.status === 'collected' && data.type === 'return' && <Button onClick={refund}>환불 실행</Button>}
                {data.status === 'collected' && data.type === 'exchange' && <Button onClick={createExchangeOrder}>교환발송 주문 생성</Button>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">요청 정보</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>유형: {data.type === 'return' ? '반품' : '교환'}</div>
              <div>사유: {data.reason}</div>
              {data.reasonDetail && <div>상세: {data.reasonDetail}</div>}
              {data.rejectReason && <div className="text-red-600">반려 사유: {data.rejectReason}</div>}
              <div>택배비 부담: {data.customerBearsShipping ? '고객' : '판매자'}</div>
              {data.returnTrackingNumber && <div>반송 송장: {data.returnTrackingCompany} / {data.returnTrackingNumber}</div>}
              {data.refundAmount && <div>환불액: {data.refundAmount.toLocaleString()}원</div>}
              {data.replacementOrderId && <div>교환발송 주문: #{data.replacementOrderId}</div>}
              {data.adminMemo && <div>관리자 메모: {data.adminMemo}</div>}
              {Array.isArray(data.photos) && data.photos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {data.photos.map((url: string, i: number) => <img key={i} src={url} alt="" className="w-24 h-24 object-cover rounded" />)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">요청 항목</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {data.items.map((it: any) => (
                  <li key={it.id}>{it.orderItem.productName} × {it.quantity} (단가 {it.unitPrice.toLocaleString()}원)</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
