"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const STATUS_LABEL: Record<string, string> = {
  requested: '요청 (관리자 검토 대기)', approved: '승인 (반송 필요)', rejected: '반려',
  collected: '수취완료', completed: '처리완료',
}

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<any>(null)
  const [trackCompany, setTrackCompany] = useState('')
  const [trackNumber, setTrackNumber] = useState('')
  const load = () => fetch(`/api/shop/returns/${id}`).then(r => r.json()).then(d => setData(d.request))
  useEffect(() => { load() }, [id])
  if (!data) return <MyPageLayout><div className="p-6">로딩...</div></MyPageLayout>

  const saveTracking = async () => {
    const r = await fetch(`/api/shop/returns/${id}/tracking`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnTrackingCompany: trackCompany, returnTrackingNumber: trackNumber }),
    })
    if (r.ok) load()
    else alert((await r.json()).error ?? '저장 실패')
  }
  const cancelRequest = async () => {
    if (!confirm('요청을 취소하시겠습니까?')) return
    const r = await fetch(`/api/shop/returns/${id}`, { method: 'DELETE' })
    if (r.ok) window.location.href = '/shop/mypage/returns'
    else alert((await r.json()).error ?? '실패')
  }
  return (
    <MyPageLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">교환/반품 #{data.id}</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">진행 상태</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{STATUS_LABEL[data.status]}</p>
            {data.rejectReason && <p className="text-sm text-red-600">반려 사유: {data.rejectReason}</p>}
            {data.refundedAt && <p className="text-sm text-green-600">환불 완료: {data.refundAmount?.toLocaleString()}원</p>}
            {data.replacementOrderId && <p className="text-sm">교환발송 주문: {data.replacementOrderId}</p>}
            {data.status === 'requested' && <Button variant="outline" onClick={cancelRequest}>요청 취소</Button>}
          </CardContent>
        </Card>

        {data.status === 'approved' && !data.returnTrackingNumber && (
          <Card>
            <CardHeader><CardTitle className="text-base">반송 송장 입력</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="택배사" value={trackCompany} onChange={e => setTrackCompany(e.target.value)} />
              <Input placeholder="송장번호" value={trackNumber} onChange={e => setTrackNumber(e.target.value)} />
              <Button onClick={saveTracking}>저장</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">요청 항목</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {data.items.map((it: any) => (
                <li key={it.id}>{it.orderItem.productName} × {it.quantity}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </MyPageLayout>
  )
}
