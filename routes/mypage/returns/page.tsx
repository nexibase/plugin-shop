"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { MyPageLayout } from "@/components/layout/MyPageLayout"

const STATUS_LABEL: Record<string, string> = {
  requested: '요청', approved: '승인', rejected: '반려', collected: '수취완료', completed: '완료',
}
const TYPE_LABEL: Record<string, string> = { return: '반품', exchange: '교환' }

interface ReturnRow { id: number; type: string; reason: string; status: string; createdAt: string; order: { orderNo: string; finalPrice: number }; items: { quantity: number }[] }

export default function ReturnsListPage() {
  const [rows, setRows] = useState<ReturnRow[]>([])
  useEffect(() => {
    fetch('/api/shop/returns').then(r => r.json()).then(d => setRows(d.requests ?? []))
  }, [])
  return (
    <MyPageLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">교환/반품 내역</h1>
        {rows.length === 0 && <p className="text-muted-foreground">요청 내역이 없습니다.</p>}
        <div className="space-y-2">
          {rows.map(r => (
            <Link key={r.id} href={`/shop/mypage/returns/${r.id}`} className="block p-4 border rounded-lg hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">#{r.id}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-muted">{TYPE_LABEL[r.type]}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{STATUS_LABEL[r.status]}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">주문 {r.order.orderNo} · {r.items.length}항목</div>
            </Link>
          ))}
        </div>
      </div>
    </MyPageLayout>
  )
}
