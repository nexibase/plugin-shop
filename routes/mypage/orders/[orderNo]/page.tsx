"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Loader2,
  ChevronLeft,
  Package,
  Truck,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ExternalLink,
  ShoppingBag,
} from "lucide-react"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { getTrackingUrlByName } from "@/plugins/shop/lib/delivery"

interface Order {
  id: number
  orderNo: string
  ordererName: string
  ordererPhone: string
  ordererEmail: string | null
  recipientName: string
  recipientPhone: string
  zipCode: string
  address: string
  addressDetail: string | null
  deliveryMemo: string | null
  totalPrice: number
  deliveryFee: number
  finalPrice: number
  status: string
  paymentMethod: string
  paidAt: string | null
  trackingCompany: string | null
  trackingNumber: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelReason: string | null
  cancelledAt: string | null
  refundAmount: number | null
  refundedAt: string | null
  createdAt: string
  updatedAt: string
  items: {
    id: number
    productName: string
    optionText: string | null
    price: number
    quantity: number
    subtotal: number
    productImage: string | null
    productSlug: string | null
  }[]
}

// Steps shown in the progress stepper (normal fulfillment flow)
const STEPS = [
  { key: 'paid',      label: '결제완료' },
  { key: 'preparing', label: '배송준비' },
  { key: 'shipping',  label: '배송중' },
  { key: 'delivered', label: '배송완료' },
  { key: 'confirmed', label: '구매확정' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STATUS_META: Record<string, { labelKey: string; color: string; icon: any }> = {
  pending:          { labelKey: "order.statusPending",          color: "bg-yellow-500", icon: AlertCircle },
  paid:             { labelKey: "order.statusPaid",             color: "bg-blue-500",   icon: CreditCard },
  preparing:        { labelKey: "order.statusPreparing",        color: "bg-indigo-500", icon: Package },
  shipping:         { labelKey: "order.statusShipping",         color: "bg-purple-500", icon: Truck },
  delivered:        { labelKey: "order.statusDelivered",        color: "bg-green-500",  icon: CheckCircle2 },
  confirmed:        { labelKey: "order.statusConfirmed",        color: "bg-green-700",  icon: CheckCircle2 },
  cancel_requested: { labelKey: "order.statusCancelRequested",  color: "bg-orange-500", icon: XCircle },
  cancelled:        { labelKey: "order.statusCancelled",        color: "bg-gray-500",   icon: XCircle },
  refund_requested: { labelKey: "order.statusRefundRequested",  color: "bg-orange-500", icon: RotateCcw },
  refunded:         { labelKey: "order.statusRefunded",         color: "bg-red-500",    icon: RotateCcw },
}

export default function MyPageOrderDetailPage() {
  const t = useTranslations('shop')
  const params = useParams()
  const router = useRouter()
  const orderNo = params.orderNo as string

  const [order, setOrder] = useState<Order | null>(null)
  const [bankInfo, setBankInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAction, setDialogAction] = useState<"cancel" | "refund" | "confirm">("cancel")
  const [selectedReason, setSelectedReason] = useState("")
  const [customReason, setCustomReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const cancelReasons = [
    t('order.cancelReasons.mistake'),
    t('order.cancelReasons.changedMind'),
    t('order.cancelReasons.reorder'),
    t('order.cancelReasons.other'),
  ]
  const refundReasons = [
    t('order.refundReasons.different'),
    t('order.refundReasons.damaged'),
    t('order.refundReasons.wrongShipping'),
    t('order.refundReasons.changedMind'),
    t('order.refundReasons.other'),
  ]

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shop/orders/${orderNo}`)
      if (res.status === 401) {
        router.push(`/login?redirect=/shop/mypage/orders/${orderNo}`)
        return
      }
      if (!res.ok) {
        setError(t('order.notFound'))
        return
      }
      const data = await res.json()
      setOrder(data.order)
      setBankInfo(data.bankInfo)
    } catch {
      setError(t('order.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrder() }, [orderNo])

  const handleAction = async () => {
    if (!order) return

    // For confirm action, use the dedicated confirm endpoint
    if (dialogAction === "confirm") {
      setActionLoading(true)
      try {
        const res = await fetch(`/api/shop/orders/${orderNo}/confirm`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) {
          alert(data.error ?? t('order.processFailed'))
          return
        }
        setDialogOpen(false)
        fetchOrder()
      } catch {
        alert(t('order.processError'))
      } finally {
        setActionLoading(false)
      }
      return
    }

    if (!selectedReason) {
      alert(t('order.selectReason'))
      return
    }
    const isOther = selectedReason === t('order.cancelReasons.other') || selectedReason === t('order.refundReasons.other')
    if (isOther && !customReason.trim()) {
      alert(t('order.enterOtherReason'))
      return
    }
    const finalReason = isOther ? customReason.trim() : selectedReason

    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop/orders/${orderNo}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: dialogAction === "refund" ? "refund_request" : dialogAction,
          cancelReason: finalReason,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || t('order.processFailed'))
        return
      }
      setDialogOpen(false)
      setSelectedReason("")
      setCustomReason("")
      fetchOrder()
    } catch {
      alert(t('order.processError'))
    } finally {
      setActionLoading(false)
    }
  }

  const openDialog = (action: "cancel" | "refund" | "confirm") => {
    setDialogAction(action)
    setSelectedReason("")
    setCustomReason("")
    setDialogOpen(true)
  }

  const formatPrice = (price: number) => t('policy.won', { amount: price.toLocaleString() })
  const formatDate = (date: string | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleString("ko-KR")
  }

  return (
    <MyPageLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error || !order ? (
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">{error || t('order.notFound')}</p>
          <Button onClick={() => router.push("/shop/mypage/orders")}>{t('order.backToOrders')}</Button>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {/* Back button */}
            <Button variant="ghost" size="sm" onClick={() => router.push("/shop/mypage/orders")}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t('order.backToOrders')}
            </Button>

            {/* Status stepper */}
            {STEPS.findIndex(s => s.key === order.status) >= 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{t('order.orderNoLabel', { no: order.orderNo })}</span>
                    <Badge className={STATUS_META[order.status]?.color || 'bg-gray-500'}>
                      {STATUS_META[order.status] ? t(STATUS_META[order.status].labelKey as any) : order.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stepper */}
                  <ol className="flex items-center">
                    {STEPS.map((s, i) => {
                      const stepIndex = STEPS.findIndex(st => st.key === order.status)
                      const active = i <= stepIndex
                      return (
                        <li key={s.key} className="flex-1 flex items-center min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {i + 1}
                          </div>
                          <span className={`ml-1 text-xs hidden sm:inline flex-shrink-0 ${active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s.label}</span>
                          {i < STEPS.length - 1 && (
                            <div className={`h-0.5 flex-1 mx-2 ${i < stepIndex ? 'bg-primary' : 'bg-muted'}`} />
                          )}
                        </li>
                      )
                    })}
                  </ol>

                  {/* Shipping info */}
                  {order.trackingNumber && (
                    <div className="p-4 bg-muted rounded-lg text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">{t('order.trackingCompany')}</span>{" "}
                        {order.trackingCompany}
                      </p>
                      <p>
                        <span className="text-muted-foreground">{t('order.trackingNumber')}</span>{" "}
                        {order.trackingNumber}
                      </p>
                      {order.trackingCompany && (
                        <a
                          href={getTrackingUrlByName(order.trackingCompany, order.trackingNumber) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t('order.tracking')}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Cancel reason */}
                  {order.cancelReason && (
                    <div className="p-4 bg-red-100 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg">
                      <p className="text-sm text-red-800 dark:text-red-200">
                        <span className="font-medium">{t('order.cancelRefundReason')}</span> {order.cancelReason}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Non-stepper statuses: show plain status card */}
            {STEPS.findIndex(s => s.key === order.status) < 0 && (
              <Card>
                <CardContent className="py-4 flex items-center gap-3">
                  <div className={`p-2 rounded-full ${STATUS_META[order.status]?.color || 'bg-gray-500'}`}>
                    {(() => {
                      const Icon = STATUS_META[order.status]?.icon || AlertCircle
                      return <Icon className="h-5 w-5 text-white" />
                    })()}
                  </div>
                  <div>
                    <p className="font-medium">
                      {STATUS_META[order.status] ? t(STATUS_META[order.status].labelKey as any) : order.status}
                    </p>
                    <p className="text-sm text-muted-foreground">{t('order.orderNoLabel', { no: order.orderNo })}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {t('checkout.orderItems')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
                    <div className="w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                      {item.productImage ? (
                        <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {item.productSlug ? (
                        <Link href={`/shop/products/${item.productSlug}`} className="hover:text-primary">
                          <h3 className="font-medium line-clamp-1">{item.productName}</h3>
                        </Link>
                      ) : (
                        <h3 className="font-medium line-clamp-1">{item.productName}</h3>
                      )}
                      {item.optionText && (
                        <p className="text-sm text-muted-foreground">{item.optionText}</p>
                      )}
                      <p className="text-sm">
                        {formatPrice(item.price)} × {t('order.itemCountShort', { count: item.quantity })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold">{formatPrice(item.subtotal)}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Shipping address */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  {t('checkout.shipping')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex">
                  <span className="w-24 text-muted-foreground">{t('order.recipient')}</span>
                  <span>{order.recipientName}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-muted-foreground">{t('order.phone')}</span>
                  <span>{order.recipientPhone}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-muted-foreground">{t('order.address')}</span>
                  <span>[{order.zipCode}] {order.address}{order.addressDetail && ` ${order.addressDetail}`}</span>
                </div>
                {order.deliveryMemo && (
                  <div className="flex">
                    <span className="w-24 text-muted-foreground">{t('order.deliveryMemo')}</span>
                    <span>{order.deliveryMemo}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {t('order.paymentInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('order.productAmount')}</span>
                  <span>{formatPrice(order.totalPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('order.shippingFee')}</span>
                  <span>{formatPrice(order.deliveryFee)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">{t('checkout.totalAmount')}</span>
                  <span className="text-lg font-bold text-primary">{formatPrice(order.finalPrice)}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-muted-foreground">{t('order.paymentMethod')}</span>
                  <span>{order.paymentMethod === "bank" ? t('checkout.bankTransfer') : t('checkout.cardPayment')}</span>
                </div>
                {order.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('order.paymentDate')}</span>
                    <span>{formatDate(order.paidAt)}</span>
                  </div>
                )}
                {order.paymentMethod === "bank" && bankInfo && (
                  <div className="mt-3 pt-3 border-t border-dashed">
                    <p className="text-sm text-muted-foreground mb-1">{t('order.bankAccount')}</p>
                    <p className="text-sm whitespace-pre-line">{bankInfo}</p>
                  </div>
                )}
                {(order.refundAmount !== null || ["cancelled", "refunded", "refund_requested"].includes(order.status)) && (
                  <div className="pt-3 mt-3 border-t border-dashed space-y-2">
                    <h4 className="font-medium text-red-600">{t('order.refundInfo')}</h4>
                    {order.refundAmount !== null && order.refundAmount < order.finalPrice && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('order.returnShippingDeducted')}</span>
                        <span>-{formatPrice(order.finalPrice - order.refundAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>{order.status === "refund_requested" ? t('order.expectedRefundAmount') : t('order.refundAmount')}</span>
                      <span>{formatPrice(order.refundAmount || order.finalPrice)}</span>
                    </div>
                    {order.status === "refund_requested" && (
                      <p className="text-xs text-muted-foreground">{t('order.refundApprovalNotice')}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('order.orderHistory')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('order.orderedAt')}</span>
                  <span>{formatDate(order.createdAt)}</span>
                </div>
                {order.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('order.paymentDate')}</span>
                    <span>{formatDate(order.paidAt)}</span>
                  </div>
                )}
                {order.shippedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('order.shippingStart')}</span>
                    <span>{formatDate(order.shippedAt)}</span>
                  </div>
                )}
                {order.deliveredAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('order.deliveryCompleted')}</span>
                    <span>{formatDate(order.deliveredAt)}</span>
                  </div>
                )}
                {order.cancelledAt && (
                  <div className="flex justify-between text-red-500">
                    <span>{t('order.cancelDate')}</span>
                    <span>{formatDate(order.cancelledAt)}</span>
                  </div>
                )}
                {order.refundedAt && (
                  <div className="flex justify-between text-red-500">
                    <span>{t('order.refundDate')}</span>
                    <span>{formatDate(order.refundedAt)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex gap-3 flex-wrap">
              {["pending", "paid", "preparing", "shipping", "delivered"].includes(order.status) && (
                <Button className="flex-1" onClick={() => router.push("/shop")}>
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  {t('order.continueShopping')}
                </Button>
              )}
              {["pending", "paid"].includes(order.status) && (
                <Button
                  variant="outline"
                  className="flex-1 text-muted-foreground hover:text-destructive hover:border-destructive"
                  onClick={() => openDialog("cancel")}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {t('order.cancelOrder')}
                </Button>
              )}
              {order.status === "preparing" && (
                <Button
                  variant="outline"
                  className="flex-1 text-muted-foreground hover:text-destructive hover:border-destructive"
                  onClick={() => openDialog("cancel")}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {t('order.cancelRequest')}
                </Button>
              )}
              {order.status === "cancel_requested" && (
                <div className="flex-1 p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 space-y-1">
                  <p className="font-medium">{t('order.cancelRequestReceived')}</p>
                  {order.cancelReason && <p>{t('order.cancelReason', { reason: order.cancelReason })}</p>}
                  <p className="text-xs text-orange-600 border-t border-orange-200 pt-1">{t('order.cancelAdminNotice')}</p>
                </div>
              )}
              {["shipping", "delivered"].includes(order.status) && (
                <Button
                  variant="outline"
                  className="flex-1 text-muted-foreground hover:text-destructive hover:border-destructive"
                  onClick={() => openDialog("refund")}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('order.requestRefund')}
                </Button>
              )}
              {order.status === "refund_requested" && (
                <div className="flex-1 p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 space-y-1">
                  <p className="font-medium">{t('order.refundRequestReceived')}</p>
                  {order.cancelReason && <p>{t('order.refundReason', { reason: order.cancelReason })}</p>}
                  {order.refundAmount !== null && (
                    <p>{t('order.expectedRefundLabel', { amount: formatPrice(order.refundAmount) })}</p>
                  )}
                  <p className="text-xs text-orange-600 border-t border-orange-200 pt-1">{t('order.refundAdminNotice')}</p>
                </div>
              )}
              {order.status === "delivered" && (
                <Button className="flex-1" onClick={() => openDialog("confirm")}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t('order.confirmPurchase')}
                </Button>
              )}
              {(order.status === 'delivered' || order.status === 'confirmed') && (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/shop/mypage/orders/${order.orderNo}/return`)}
                >
                  반품/교환 신청
                </Button>
              )}
            </div>
          </div>

          {/* Action dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {dialogAction === "cancel" && t('order.cancelOrder')}
                  {dialogAction === "refund" && t('order.requestRefund')}
                  {dialogAction === "confirm" && t('order.confirmPurchase')}
                </DialogTitle>
                <DialogDescription>
                  {dialogAction === "cancel" && t('order.cancelConfirm')}
                  {dialogAction === "refund" && t('order.refundConfirm')}
                  {dialogAction === "confirm" && t('order.purchaseConfirm')}
                </DialogDescription>
              </DialogHeader>

              {dialogAction === "cancel" && order?.status === "preparing" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <p className="font-medium mb-1">{t('order.preparingNotice')}</p>
                  <p>{t('order.preparingNoticeDetail')}</p>
                </div>
              )}

              {dialogAction !== "confirm" && (
                <div className="space-y-4">
                  <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
                    {(dialogAction === "cancel" ? cancelReasons : refundReasons).map((reason) => (
                      <div key={reason} className="flex items-center space-x-2">
                        <RadioGroupItem value={reason} id={reason} />
                        <Label htmlFor={reason} className="cursor-pointer">{reason}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {(selectedReason === t('order.cancelReasons.other') || selectedReason === t('order.refundReasons.other')) && (
                    <Textarea
                      placeholder={t('order.otherReasonPlaceholder')}
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      rows={3}
                    />
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('address.cancel')}</Button>
                <Button
                  onClick={handleAction}
                  disabled={actionLoading}
                  variant={dialogAction === "confirm" ? "default" : "destructive"}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {dialogAction === "cancel" && t('order.cancelOrder')}
                      {dialogAction === "refund" && t('order.requestRefund')}
                      {dialogAction === "confirm" && t('order.confirmPurchase')}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </MyPageLayout>
  )
}
