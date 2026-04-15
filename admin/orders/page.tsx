"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
  Eye,
  RefreshCw,
  Trash2,
  RotateCcw,
  Printer,
} from "lucide-react"

interface Order {
  id: number
  orderNo: string
  ordererName: string
  ordererPhone: string
  recipientName: string
  totalPrice: number
  deliveryFee: number
  finalPrice: number
  status: string
  paymentMethod: string
  createdAt: string
  items: {
    id: number
    productName: string
    quantity: number
    productImage: string | null
  }[]
  user: {
    id: number
    name: string
    email: string
  }
}

interface Stats {
  all: number
  pending: number
  paid: number
  preparing: number
  shipping: number
  delivered: number
  confirmed: number
  cancel_requested: number
  cancelled: number
  refund_requested: number
  refunded: number
  deleted: number
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  paid: "bg-blue-500",
  preparing: "bg-indigo-500",
  shipping: "bg-purple-500",
  delivered: "bg-green-500",
  confirmed: "bg-green-700",
  cancel_requested: "bg-orange-500",
  cancelled: "bg-gray-500",
  refund_requested: "bg-amber-500",
  refunded: "bg-red-500",
}

const STATUS_KEYS = [
  'pending', 'paid', 'preparing', 'shipping', 'delivered',
  'confirmed', 'cancel_requested', 'cancelled', 'refund_requested', 'refunded'
] as const

const STATUS_I18N_KEY: Record<string, string> = {
  pending: 'statusPending',
  paid: 'statusPaid',
  preparing: 'statusPreparing',
  shipping: 'statusShipping',
  delivered: 'statusDelivered',
  confirmed: 'statusConfirmed',
  cancel_requested: 'statusCancelRequested',
  cancelled: 'statusCancelled',
  refund_requested: 'statusRefundRequested',
  refunded: 'statusRefunded',
}

export default function AdminOrdersPage() {
  const t = useTranslations('shop.admin')
  const to = useTranslations('shop.order')
  const tp = useTranslations('shop.policy')
  const router = useRouter()
  const searchParams = useSearchParams()

  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const status = searchParams.get('status') || ''
  const search = searchParams.get('search') || ''
  const showDeleted = searchParams.get('deleted') === 'true'
  const [searchInput, setSearchInput] = useState(search)
  const [selectedOrders, setSelectedOrders] = useState<number[]>([])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(status && { status }),
        ...(search && { search }),
        ...(showDeleted && { deleted: 'true' }),
      })

      const res = await fetch(`/api/admin/shop/orders?${params}`)
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }, [page, status, search, showDeleted])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    setPage(1)
    setSelectedOrders([])
  }, [status, search, showDeleted])

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(orders.map(o => o.id))
    } else {
      setSelectedOrders([])
    }
  }

  // Select one
  const handleSelectOrder = (orderId: number, checked: boolean) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId])
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId))
    }
  }

  // 다중 라벨 출력
  const handlePrintLabels = async () => {
    if (selectedOrders.length === 0) {
      alert(t('selectOrdersToPrint'))
      return
    }

    // form 으로 POST 요청하여 새 창에서 열기
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = '/api/admin/shop/orders/labels'
    form.target = '_blank'

    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = 'orderIds'
    input.value = JSON.stringify(selectedOrders)

    // JSON body로 전송하기 위한 처리
    const jsonInput = document.createElement('input')
    jsonInput.type = 'hidden'
    jsonInput.name = 'json'
    jsonInput.value = JSON.stringify({ orderIds: selectedOrders })

    form.appendChild(input)
    document.body.appendChild(form)

    // form 대신 fetch로 blob 받아서 새 창에서 열기
    try {
      const res = await fetch('/api/admin/shop/orders/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: selectedOrders })
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || t('labelPrintFailed'))
        return
      }

      const html = await res.text()
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (error) {
      console.error('라벨 출력 에러:', error)
      alert(t('labelPrintError'))
    }

    document.body.removeChild(form)
  }

  const handleStatusChange = (newStatus: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newStatus === 'deleted') {
      params.set('deleted', 'true')
      params.delete('status')
    } else {
      params.delete('deleted')
      if (newStatus && newStatus !== 'all') {
        params.set('status', newStatus)
      } else {
        params.delete('status')
      }
    }
    params.delete('page')
    router.push(`/admin/shop/orders?${params}`)
  }

  const handleRestore = async (orderId: number) => {
    if (!confirm(t('restoreConfirm'))) return

    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' })
      })

      if (res.ok) {
        fetchOrders()
      } else {
        const data = await res.json()
        alert(data.error || t('restoreFailed'))
      }
    } catch (error) {
      console.error('복원 에러:', error)
      alert(t('restoreError'))
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (searchInput.trim()) {
      params.set('search', searchInput.trim())
    } else {
      params.delete('search')
    }
    params.delete('page')
    router.push(`/admin/shop/orders?${params}`)
  }

  const formatPrice = (price: number) => tp('won', { amount: price.toLocaleString() })
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString(undefined, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {showDeleted ? (
                  <span className="flex items-center gap-2">
                    <Trash2 className="h-6 w-6 text-red-500" />
                    {t('deletedOrders')}
                  </span>
                ) : t('orderManagement')}
              </h1>
              <p className="text-muted-foreground">
                {t('totalOrdersText', { total, deleted: showDeleted ? t('deletedPrefix') : '' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedOrders.length > 0 && (
                <Button variant="outline" onClick={handlePrintLabels}>
                  <Printer className="h-4 w-4 mr-2" />
                  {t('printLabelWithCount', { count: selectedOrders.length })}
                </Button>
              )}
              <Button variant="outline" onClick={fetchOrders}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('refresh')}
              </Button>
            </div>
          </div>

          {/* 상태별 통계 */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-2">
              <button
                onClick={() => handleStatusChange('all')}
                className={`p-3 rounded-lg text-center transition-colors ${
                  !status && !showDeleted ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <p className="text-lg font-bold">{stats.all}</p>
                <p className="text-xs">{t('all')}</p>
              </button>
              {STATUS_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => handleStatusChange(key)}
                  className={`p-3 rounded-lg text-center transition-colors ${
                    status === key && !showDeleted ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  <p className="text-lg font-bold">{stats[key as keyof Stats] || 0}</p>
                  <p className="text-xs">{to(STATUS_I18N_KEY[key])}</p>
                </button>
              ))}
              <button
                onClick={() => handleStatusChange('deleted')}
                className={`p-3 rounded-lg text-center transition-colors ${
                  showDeleted ? 'bg-red-500 text-white' : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <p className="text-lg font-bold">{stats.deleted || 0}</p>
                <p className="text-xs flex items-center justify-center gap-1">
                  <Trash2 className="h-3 w-3" />
                  {t('deletedLabel')}
                </p>
              </button>
            </div>
          )}

          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('orderSearchPlaceholder')}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button type="submit">{t('search')}</Button>
              </form>
            </CardContent>
          </Card>

          {/* 주문 목록 */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-20">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('noOrders')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={orders.length > 0 && selectedOrders.length === orders.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-[140px]">{t('orderNo')}</TableHead>
                      <TableHead>{t('orderItems')}</TableHead>
                      <TableHead>{t('orderer')}</TableHead>
                      <TableHead className="text-right">{t('paymentAmount')}</TableHead>
                      <TableHead>{t('paymentMethod')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead>{t('orderDate')}</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm leading-tight">
                            <div>{order.orderNo.split('-')[0]}</div>
                            <div className="text-muted-foreground">-{order.orderNo.split('-')[1]}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {order.items[0]?.productImage ? (
                              <img
                                src={order.items[0].productImage}
                                alt=""
                                className="w-10 h-10 rounded object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium line-clamp-1">
                                {order.items[0]?.productName}
                                {order.items.length > 1 && t('otherItemsMore', { count: order.items.length - 1 })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t('totalItemsCount', { count: order.items.reduce((sum, item) => sum + item.quantity, 0) })}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.ordererName}</p>
                            <p className="text-xs text-muted-foreground">{order.ordererPhone}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatPrice(order.finalPrice)}
                        </TableCell>
                        <TableCell>
                          {order.paymentMethod === 'bank' ? t('bank') : t('card')}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[order.status] || 'bg-gray-500'}>
                            {STATUS_I18N_KEY[order.status] ? to(STATUS_I18N_KEY[order.status]) : order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Link href={`/admin/shop/orders/${order.orderNo}`}>
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            {showDeleted && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRestore(order.id)}
                                title={t('restore')}
                              >
                                <RotateCcw className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
