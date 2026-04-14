"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Loader2,
	Package,
	ChevronLeft,
	ChevronRight,
	Eye,
} from "lucide-react"

interface Order {
	id: number
	orderNo: string
	totalPrice: number
	deliveryFee: number
	finalPrice: number
	status: string
	paymentMethod: string
	createdAt: string
	items: {
		id: number
		productName: string
		optionText: string | null
		price: number
		quantity: number
		productImage: string | null
		productSlug: string | null
	}[]
}

const STATUS_META: Record<string, { labelKey: string; color: string }> = {
	pending: { labelKey: "order.statusPending", color: "bg-yellow-500" },
	paid: { labelKey: "order.statusPaid", color: "bg-blue-500" },
	preparing: { labelKey: "order.statusPreparing", color: "bg-indigo-500" },
	shipping: { labelKey: "order.statusShipping", color: "bg-purple-500" },
	delivered: { labelKey: "order.statusDelivered", color: "bg-green-500" },
	confirmed: { labelKey: "order.statusConfirmed", color: "bg-green-700" },
	cancelled: { labelKey: "order.statusCancelled", color: "bg-gray-500" },
	refund_requested: { labelKey: "order.statusRefundRequested", color: "bg-orange-500" },
	refunded: { labelKey: "order.statusRefunded", color: "bg-red-500" },
}

export default function OrdersPage() {
	const t = useTranslations('shop')
	const router = useRouter()

	const [orders, setOrders] = useState<Order[]>([])
	const [ordersLoading, setOrdersLoading] = useState(true)
	const [ordersPage, setOrdersPage] = useState(1)
	const [ordersTotalPages, setOrdersTotalPages] = useState(1)
	const [statusFilter, setStatusFilter] = useState("")

	const fetchOrders = useCallback(async () => {
		setOrdersLoading(true)
		try {
			const params = new URLSearchParams({
				page: String(ordersPage),
				limit: '10',
				...(statusFilter && { status: statusFilter }),
			})

			const res = await fetch(`/api/shop/orders?${params}`)
			if (res.status === 401) {
				router.push('/login?redirect=/shop/mypage/orders')
				return
			}
			if (res.ok) {
				const data = await res.json()
				setOrders(data.orders)
				setOrdersTotalPages(data.pagination.totalPages)
			}
		} catch (error) {
			console.error('주문 목록 조회 에러:', error)
		} finally {
			setOrdersLoading(false)
		}
	}, [ordersPage, statusFilter, router])

	useEffect(() => {
		fetchOrders()
	}, [fetchOrders])

	useEffect(() => {
		setOrdersPage(1)
	}, [statusFilter])

	const formatPrice = (price: number) => t('policy.won', { amount: price.toLocaleString() })
	const formatDate = (date: string) => {
		return new Date(date).toLocaleDateString('ko-KR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		})
	}

	return (
		<MyPageLayout>
			{/* 필터 */}
			<div className="flex justify-end mb-4">
				<Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
					<SelectTrigger className="w-[140px]">
						<SelectValue placeholder={t('order.statusAll')} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t('categoryAll')}</SelectItem>
						{Object.entries(STATUS_META).map(([value, { labelKey }]) => (
							<SelectItem key={value} value={value}>
								{t(labelKey as any)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* 주문 목록 */}
			{ordersLoading ? (
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			) : orders.length === 0 ? (
				<Card>
					<CardContent className="py-16 text-center">
						<Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
						<p className="text-muted-foreground mb-4">{t('order.noOrders')}</p>
						<Button onClick={() => router.push('/shop')}>
							{t('goShopping')}
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{orders.map((order) => (
						<Card key={order.id}>
							<CardHeader className="pb-2">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm text-muted-foreground">
											{formatDate(order.createdAt)}
										</p>
										<p className="font-mono text-sm">{order.orderNo}</p>
									</div>
									<Badge className={STATUS_META[order.status]?.color || 'bg-gray-500'}>
										{STATUS_META[order.status] ? t(STATUS_META[order.status].labelKey as any) : order.status}
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								{/* 주문 상품 */}
								{order.items.slice(0, 2).map((item) => (
									<div key={item.id} className="flex gap-4">
										{item.productSlug ? (
											<Link
												href={`/shop/products/${item.productSlug}`}
												className="w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0 hover:ring-2 ring-primary transition-all"
											>
												{item.productImage ? (
													<img
														src={item.productImage}
														alt={item.productName}
														className="w-full h-full object-cover"
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center">
														<Package className="h-6 w-6 text-muted-foreground" />
													</div>
												)}
											</Link>
										) : (
											<div className="w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
												{item.productImage ? (
													<img
														src={item.productImage}
														alt={item.productName}
														className="w-full h-full object-cover"
													/>
												) : (
													<div className="w-full h-full flex items-center justify-center">
														<Package className="h-6 w-6 text-muted-foreground" />
													</div>
												)}
											</div>
										)}
										<div className="flex-1 min-w-0">
											{item.productSlug ? (
												<Link href={`/shop/products/${item.productSlug}`} className="font-medium line-clamp-1 hover:underline">
													{item.productName}
												</Link>
											) : (
												<h3 className="font-medium line-clamp-1">{item.productName}</h3>
											)}
											{item.optionText && (
												<p className="text-sm text-muted-foreground">{item.optionText}</p>
											)}
											<p className="text-sm">
												{formatPrice(item.price)} x {t('order.itemCountShort', { count: item.quantity })}
											</p>
										</div>
									</div>
								))}
								{order.items.length > 2 && (
									<p className="text-sm text-muted-foreground">
										{t('order.moreItems', { count: order.items.length - 2 })}
									</p>
								)}

								{/* 결제 정보 및 버튼 */}
								<div className="flex items-center justify-between pt-4 border-t">
									<div>
										<p className="text-sm text-muted-foreground">{t('order.paymentAmount')}</p>
										<p className="font-bold text-lg">{formatPrice(order.finalPrice)}</p>
									</div>
									<Link href={`/shop/orders/${order.orderNo}`}>
										<Button variant="outline">
											<Eye className="h-4 w-4 mr-2" />
											{t('order.viewDetailShort')}
										</Button>
									</Link>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* 주문 페이지네이션 */}
			{ordersTotalPages > 1 && (
				<div className="flex items-center justify-center gap-2 mt-8">
					<Button
						variant="outline"
						size="icon"
						onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
						disabled={ordersPage === 1}
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<span className="text-sm text-muted-foreground px-4">
						{ordersPage} / {ordersTotalPages}
					</span>
					<Button
						variant="outline"
						size="icon"
						onClick={() => setOrdersPage(p => Math.min(ordersTotalPages, p + 1))}
						disabled={ordersPage === ordersTotalPages}
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			)}
		</MyPageLayout>
	)
}
