"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

const TYPE_LABEL: Record<string, string> = { return: '반품', exchange: '교환' }
const STATUS_LABEL: Record<string, string> = {
  requested: '요청', approved: '승인', rejected: '반려', collected: '수취완료', completed: '완료',
}

interface RelatedReturnRow {
  id: number
  type: string
  status: string
  createdAt: string
  orderId: number
  order?: { id: number }
}

export function RelatedReturns({ orderId }: { orderId: number }) {
  const [rows, setRows] = useState<RelatedReturnRow[]>([])
  useEffect(() => {
    fetch('/api/admin/shop/returns').then(r => r.json()).then(d => {
      const all: RelatedReturnRow[] = d.requests ?? []
      setRows(all.filter(r => (r.order?.id ?? r.orderId) === orderId))
    })
  }, [orderId])
  if (rows.length === 0) return null
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">교환/반품 이력</h3>
      <div className="space-y-1">
        {rows.map(r => (
          <Link key={r.id} href={`/admin/shop/returns/${r.id}`} className="block p-2 border rounded hover:bg-muted/50 text-sm">
            #{r.id} · {TYPE_LABEL[r.type] ?? r.type} · {STATUS_LABEL[r.status] ?? r.status} · {new Date(r.createdAt).toLocaleDateString()}
          </Link>
        ))}
      </div>
    </div>
  )
}
