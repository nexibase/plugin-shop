"use client"

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { Sidebar } from "@/components/admin/Sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  Truck,
  ArrowRight,
  Loader2,
  DollarSign,
  Users,
  BarChart3,
} from "lucide-react"

interface DashboardStats {
  products: {
    total: number
    active: number
    soldOut: number
  }
  orders: {
    total: number
    pending: number
    paid: number
    preparing: number
    shipping: number
    delivered: number
    cancelled: number
  }
  sales: {
    today: number
    week: number
    month: number
  }
  recentOrders: {
    id: number
    orderNo: string
    ordererName: string
    finalPrice: number
    status: string
    createdAt: string
    itemCount: number
  }[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  paid: "bg-blue-500",
  preparing: "bg-indigo-500",
  shipping: "bg-purple-500",
  delivered: "bg-green-500",
  confirmed: "bg-green-700",
  cancelled: "bg-gray-500",
}

export default function ShopDashboardPage() {
  const t = useTranslations('shop.admin')
  const to = useTranslations('shop.order')
  const tp = useTranslations('shop.policy')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: to('statusPending'),
      paid: to('statusPaid'),
      preparing: to('statusPreparing'),
      shipping: to('statusShipping'),
      delivered: to('statusDelivered'),
      confirmed: to('statusConfirmed'),
      cancelled: to('statusCancelled'),
    }
    return map[status] || status
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/shop/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error("통계 조회 에러:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number) => tp('won', { amount: price.toLocaleString() })
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              {t('dashboard')}
            </h2>
            <p className="text-muted-foreground">
              {t('dashboardDesc')}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : stats ? (
            <>
              {/* 매출 요약 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{t('salesToday')}</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatPrice(stats.sales.today)}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <DollarSign className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{t('salesWeek')}</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatPrice(stats.sales.week)}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/5 border-purple-500/20">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{t('salesMonth')}</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {formatPrice(stats.sales.month)}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                        <BarChart3 className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 주문 현황 + 상품 현황 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* 주문 현황 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      {t('orderStatus')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <Link href="/admin/shop/orders?status=pending">
                        <div className="p-3 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4 text-yellow-600" />
                            <span className="text-sm text-muted-foreground">{to('statusPending')}</span>
                          </div>
                          <span className="text-xl font-bold text-yellow-600">
                            {stats.orders.pending}
                          </span>
                        </div>
                      </Link>

                      <Link href="/admin/shop/orders?status=paid">
                        <div className="p-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-muted-foreground">{to('statusPaid')}</span>
                          </div>
                          <span className="text-xl font-bold text-blue-600">
                            {stats.orders.paid}
                          </span>
                        </div>
                      </Link>

                      <Link href="/admin/shop/orders?status=preparing">
                        <div className="p-3 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="h-4 w-4 text-indigo-600" />
                            <span className="text-sm text-muted-foreground">{to('statusPreparing')}</span>
                          </div>
                          <span className="text-xl font-bold text-indigo-600">
                            {stats.orders.preparing}
                          </span>
                        </div>
                      </Link>

                      <Link href="/admin/shop/orders?status=shipping">
                        <div className="p-3 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <Truck className="h-4 w-4 text-purple-600" />
                            <span className="text-sm text-muted-foreground">{to('statusShipping')}</span>
                          </div>
                          <span className="text-xl font-bold text-purple-600">
                            {stats.orders.shipping}
                          </span>
                        </div>
                      </Link>
                    </div>

                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {t('totalOrders')}: <span className="font-medium text-foreground">{t('ordersCount', { count: stats.orders.total })}</span>
                      </div>
                      <Link href="/admin/shop/orders">
                        <Button variant="ghost" size="sm">
                          {t('viewAll')} <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                {/* 상품 현황 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {t('productStatus')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{t('allProducts')}</p>
                            <p className="text-xl font-bold">{stats.products.total}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-green-500/10">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-muted-foreground">{t('onSale')}</span>
                          </div>
                          <span className="text-xl font-bold text-green-600">
                            {stats.products.active}
                          </span>
                        </div>

                        <div className="p-3 rounded-lg bg-red-500/10">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <span className="text-sm text-muted-foreground">{t('soldOut')}</span>
                          </div>
                          <span className="text-xl font-bold text-red-600">
                            {stats.products.soldOut}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t flex justify-end">
                      <Link href="/admin/shop/products">
                        <Button variant="ghost" size="sm">
                          {t('productManage')} <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 최근 주문 */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      {t('recentOrders')}
                    </CardTitle>
                    <Link href="/admin/shop/orders">
                      <Button variant="ghost" size="sm">
                        {t('viewAll')} <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {stats.recentOrders.length > 0 ? (
                    <div className="space-y-3">
                      {stats.recentOrders.map((order) => (
                        <Link
                          key={order.id}
                          href={`/admin/shop/orders/${order.id}`}
                          className="block p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Users className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{order.orderNo}</span>
                                  <Badge
                                    className={`${STATUS_COLORS[order.status] || "bg-gray-500"} text-white text-xs`}
                                  >
                                    {getStatusLabel(order.status)}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {order.ordererName} · {t('itemsCount', { count: order.itemCount })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatPrice(order.finalPrice)}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(order.createdAt)}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {t('noRecentOrders')}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 빠른 링크 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <Link href="/admin/shop/products">
                  <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Package className="h-5 w-5 text-primary" />
                      <span className="font-medium">{t('productManage')}</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/admin/shop/categories">
                  <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-3">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                      <span className="font-medium">{t('categoryManage')}</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/admin/shop/orders">
                  <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <span className="font-medium">{t('orderManage')}</span>
                    </CardContent>
                  </Card>
                </Link>
                <Link href="/admin/shop/settings">
                  <Card className="hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="p-4 flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-primary" />
                      <span className="font-medium">{t('shopSettings')}</span>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              {t('dataLoadError')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
