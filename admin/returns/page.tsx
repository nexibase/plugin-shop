"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Sidebar } from "@/components/admin/Sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, RotateCcw, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ReturnRequest {
  id: number
  orderNo: string
  type: 'return' | 'exchange'
  reason: string
  status: string
  refundAmount: number | null
  createdAt: string
}

const STATUS_TABS = [
  { value: '', label: '전체' },
  { value: 'requested', label: '요청' },
  { value: 'approved', label: '승인' },
  { value: 'collected', label: '수취완료' },
  { value: 'completed', label: '완료' },
  { value: 'rejected', label: '반려' },
]

const TYPE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'return', label: '반품' },
  { value: 'exchange', label: '교환' },
]

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-yellow-500',
  approved: 'bg-blue-500',
  collected: 'bg-indigo-500',
  completed: 'bg-green-600',
  rejected: 'bg-gray-500',
}

const STATUS_LABEL: Record<string, string> = {
  requested: '요청',
  approved: '승인',
  collected: '수취완료',
  completed: '완료',
  rejected: '반려',
}

const TYPE_LABEL: Record<string, string> = {
  return: '반품',
  exchange: '교환',
}

const TYPE_COLORS: Record<string, string> = {
  return: 'bg-orange-500',
  exchange: 'bg-purple-500',
}

export default function AdminReturnsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const status = searchParams.get('status') || ''
  const type = searchParams.get('type') || ''

  const [requests, setRequests] = useState<ReturnRequest[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (type) params.set('type', type)
      const res = await fetch(`/api/admin/shop/returns?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests ?? [])
      }
    } catch (err) {
      console.error('failed to fetch returns:', err)
    } finally {
      setLoading(false)
    }
  }, [status, type])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const handleStatusChange = (s: string) => {
    const p = new URLSearchParams(searchParams.toString())
    if (s) p.set('status', s); else p.delete('status')
    router.push(`/admin/shop/returns?${p}`)
  }

  const handleTypeChange = (t: string) => {
    const p = new URLSearchParams(searchParams.toString())
    if (t) p.set('type', t); else p.delete('type')
    router.push(`/admin/shop/returns?${p}`)
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <RotateCcw className="h-6 w-6" />
                교환/반품 관리
              </h1>
              <p className="text-muted-foreground">총 {requests.length}건</p>
            </div>
            <Button variant="outline" onClick={fetchRequests}>새로고침</Button>
          </div>

          {/* Status tabs */}
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => handleStatusChange(tab.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  status === tab.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">유형:</span>
                <select
                  value={type}
                  onChange={e => handleTypeChange(e.target.value)}
                  className="border rounded-md px-3 py-1.5 text-sm bg-background"
                >
                  {TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-20">
                  <RotateCcw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">교환/반품 요청이 없습니다.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>주문번호</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead>사유</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead>요청일</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map(req => (
                      <TableRow key={req.id}>
                        <TableCell className="font-mono text-sm">#{req.id}</TableCell>
                        <TableCell className="font-mono text-sm">{req.orderNo}</TableCell>
                        <TableCell>
                          <Badge className={TYPE_COLORS[req.type] || 'bg-gray-500'}>
                            {TYPE_LABEL[req.type] ?? req.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{req.reason}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[req.status] || 'bg-gray-500'}>
                            {STATUS_LABEL[req.status] ?? req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {req.refundAmount != null ? `${req.refundAmount.toLocaleString()}원` : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(req.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Link href={`/admin/shop/returns/${req.id}`}>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
