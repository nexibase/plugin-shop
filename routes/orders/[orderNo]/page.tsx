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
  User,
  Truck,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ExternalLink,
  ShoppingBag,
} from "lucide-react"
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

// Map card-issuer code → i18n key
const CARD_NAMES: Record<string, string> = {
  "01": "cardIssuer.hanaKeb",
  "02": "cardIssuer.kbKookmin",
  "03": "cardIssuer.samsung",
  "04": "cardIssuer.hyundai",
  "06": "cardIssuer.lotte",
  "07": "cardIssuer.shinhan",
  "08": "cardIssuer.nhNonghyup",
  "11": "cardIssuer.bc",
  "12": "cardIssuer.citi",
  "13": "cardIssuer.kakaobank",
  "14": "cardIssuer.kbank",
  "15": "cardIssuer.tossbank",
  "21": "cardIssuer.visaIntl",
  "22": "cardIssuer.masterIntl",
  "23": "cardIssuer.jcbIntl",
  "24": "cardIssuer.amexIntl",
  "25": "cardIssuer.dinersIntl",
  "26": "cardIssuer.suhyup",
  "27": "cardIssuer.shinhyup",
  "28": "cardIssuer.woori",
  "29": "cardIssuer.hana",
  "30": "cardIssuer.jeonbuk",
  "31": "cardIssuer.gwangju",
  "32": "cardIssuer.postOffice",
  "33": "cardIssuer.saemaeul",
  "34": "cardIssuer.mg",
  "35": "cardIssuer.jeju",
  "36": "cardIssuer.koreaIndustrial",
  "41": "cardIssuer.bcPaybook",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STATUS_META: Record<string, { labelKey: string; color: string; icon: any }> = {
  pending: { labelKey: "order.statusPending", color: "bg-yellow-500", icon: AlertCircle },
  paid: { labelKey: "order.statusPaid", color: "bg-blue-500", icon: CreditCard },
  preparing: { labelKey: "order.statusPreparing", color: "bg-indigo-500", icon: Package },
  shipping: { labelKey: "order.statusShipping", color: "bg-purple-500", icon: Truck },
  delivered: { labelKey: "order.statusDelivered", color: "bg-green-500", icon: CheckCircle2 },
  confirmed: { labelKey: "order.statusConfirmed", color: "bg-green-700", icon: CheckCircle2 },
  cancel_requested: { labelKey: "order.statusCancelRequested", color: "bg-orange-500", icon: XCircle },
  cancelled: { labelKey: "order.statusCancelled", color: "bg-gray-500", icon: XCircle },
  refund_requested: { labelKey: "order.statusRefundRequested", color: "bg-orange-500", icon: RotateCcw },
  refunded: { labelKey: "order.statusRefunded", color: "bg-red-500", icon: RotateCcw },
}

export default function OrderDetailPage() {
  const t = useTranslations('shop')
  const params = useParams()
  const router = useRouter()
  const orderNo = params.orderNo as string

  const [order, setOrder] = useState<Order | null>(null)
  const [bankInfo, setBankInfo] = useState<string | null>(null)
  const [cardInfo, setCardInfo] = useState<{
    cardName: string | null
    cardNo: string | null
    applNum: string | null
    cardQuota: string
    applDate: string | null
    applTime: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 취소/환불 다이얼로그
  const [shopInfo, setShopInfo] = useState<{
    shop_tel?: string
    shop_email?: string
    return_info?: string
    exchange_info?: string
    return_address?: string
  }>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAction, setDialogAction] = useState<"cancel" | "refund" | "exchange" | "confirm">("cancel")
  const [selectedReason, setSelectedReason] = useState("")
  const [customReason, setCustomReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  // 취소 사유 옵션 - 번역된 문자열을 그대로 사용 (백엔드에 저장됨)
  const cancelReasons = [
    t('order.cancelReasons.mistake'),
    t('order.cancelReasons.changedMind'),
    t('order.cancelReasons.reorder'),
    t('order.cancelReasons.other'),
  ]

  // 환불 사유 옵션
  const refundReasons = [
    t('order.refundReasons.different'),
    t('order.refundReasons.damaged'),
    t('order.refundReasons.wrongShipping'),
    t('order.refundReasons.changedMind'),
    t('order.refundReasons.other'),
  ]

  useEffect(() => {
    fetchOrder()
  }, [orderNo])

  // Load shop settings (phone, email, return policy) once — used for the 교환/반품 문의 info block
  useEffect(() => {
    fetch('/api/shop/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.settings) setShopInfo(d.settings) })
      .catch(() => {})
  }, [])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shop/orders/${orderNo}`)
      if (res.status === 401) {
        router.push(`/login?redirect=/shop/orders/${orderNo}`)
        return
      }
      if (!res.ok) {
        setError(t('order.notFound'))
        return
      }
      const data = await res.json()
      setOrder(data.order)
      setBankInfo(data.bankInfo)
      setCardInfo(data.cardInfo)
    } catch (err) {
      setError(t('order.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async () => {
    if (!order) return

    // 사유 조합
    let finalReason = ""
    if (dialogAction !== "confirm") {
      if (!selectedReason) {
        alert(t('order.selectReason'))
        return
      }
      const isOther = selectedReason === t('order.cancelReasons.other') || selectedReason === t('order.refundReasons.other') || (dialogAction === 'exchange' && selectedReason === '기타')
      if (isOther && !customReason.trim()) {
        alert(t('order.enterOtherReason'))
        return
      }
      finalReason = isOther ? customReason.trim() : selectedReason
    }

    // Exchange piggy-backs on the refund_request flow but prefixes the reason
    // so admin can distinguish in the order list / activity log.
    const submittedAction = (dialogAction === "refund" || dialogAction === "exchange") ? "refund_request" : dialogAction
    const submittedReason = dialogAction === "exchange" && finalReason
      ? `[교환 요청] ${finalReason}`
      : finalReason

    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop/orders/${orderNo}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: submittedAction,
          cancelReason: submittedReason || undefined,
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
    } catch (err) {
      alert(t('order.processError'))
    } finally {
      setActionLoading(false)
    }
  }

  const openDialog = (action: "cancel" | "refund" | "exchange" | "confirm") => {
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

  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">{error || t('order.notFound')}</p>
        <Button onClick={() => router.push("/shop/orders")}>{t('order.backToOrders')}</Button>
      </div>
    )
  }

  const StatusIcon = STATUS_META[order.status]?.icon || AlertCircle

  return (
    <>
      <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" onClick={() => router.push("/shop/orders")}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t('order.detail')}
            </Button>
          </div>

          {/* 주문 상태 */}
          <Card className="mb-6">
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${STATUS_META[order.status]?.color || 'bg-gray-500'}`}>
                  <StatusIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {STATUS_META[order.status] ? t(STATUS_META[order.status].labelKey as any) : order.status}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('order.orderNoLabel', { no: order.orderNo })}
                  </p>
                </div>
              </div>

              {/* Shipping info */}
              {order.trackingNumber && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm">
                    <span className="text-muted-foreground">{t('order.trackingCompany')}</span>{" "}
                    {order.trackingCompany}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">{t('order.trackingNumber')}</span>{" "}
                    {order.trackingNumber}
                  </p>
                  {order.trackingCompany && (
                    <a
                      href={getTrackingUrlByName(order.trackingCompany, order.trackingNumber) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t('order.tracking')}
                    </a>
                  )}
                </div>
              )}

              {/* 무통장입금 안내 */}
              {order.paymentMethod === "bank" && order.status === "pending" && bankInfo && (
                <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-lg">
                  <p className="text-sm font-medium text-primary mb-2">{t('order.bankAccountInfo')}</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{bankInfo}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('order.bankAccountVerify')}
                  </p>
                </div>
              )}

              {/* 취소/환불 사유 */}
              {order.cancelReason && (
                <div className="mt-4 p-4 bg-red-100 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    <span className="font-medium">{t('order.cancelRefundReason')}</span> {order.cancelReason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order items */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {t('checkout.orderItems')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0">
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
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(item.subtotal)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Shipping address */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {t('checkout.shipping')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
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
                <span>
                  [{order.zipCode}] {order.address}
                  {order.addressDetail && ` ${order.addressDetail}`}
                </span>
              </div>
              {order.deliveryMemo && (
                <div className="flex">
                  <span className="w-24 text-muted-foreground">{t('order.deliveryMemo')}</span>
                  <span>{order.deliveryMemo}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
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
                <span className="text-lg font-bold text-primary">
                  {formatPrice(order.finalPrice)}
                </span>
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

              {/* 무통장입금 계좌 정보 */}
              {order.paymentMethod === "bank" && bankInfo && (
                <div className="mt-3 pt-3 border-t border-dashed">
                  <p className="text-sm text-muted-foreground mb-1">{t('order.bankAccount')}</p>
                  <p className="text-sm whitespace-pre-line">{bankInfo}</p>
                </div>
              )}

              {/* 카드결제 정보 */}
              {order.paymentMethod === "card" && cardInfo && (
                <div className="mt-3 pt-3 border-t border-dashed space-y-1">
                  <p className="text-sm font-medium mb-2">{t('order.paymentCardInfo')}</p>
                  {cardInfo.cardName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('order.cardCompany')}</span>
                      <span>{CARD_NAMES[cardInfo.cardName] ? t(CARD_NAMES[cardInfo.cardName] as any) : cardInfo.cardName}</span>
                    </div>
                  )}
                  {cardInfo.cardNo && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('order.cardNumber')}</span>
                      <span>{cardInfo.cardNo}</span>
                    </div>
                  )}
                  {cardInfo.applNum && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('order.approvalNumber')}</span>
                      <span>{cardInfo.applNum}</span>
                    </div>
                  )}
                  {cardInfo.cardQuota && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('order.installment')}</span>
                      <span>{cardInfo.cardQuota === "00" ? t('order.lumpSum') : t('order.months', { count: parseInt(cardInfo.cardQuota) })}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 환불 정보 */}
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
                    <p className="text-xs text-muted-foreground">
                      {t('order.refundApprovalNotice')}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 교환/반품 문의 안내 */}
          {["delivered", "confirmed"].includes(order.status) && (
            <Card className="mb-6 border-amber-200 bg-amber-50/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  교환/반품 문의
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p className="text-muted-foreground">
                  교환 또는 반품은 <strong>고객센터로 연락</strong> 후 처리됩니다. 상품 수령 후 아래 안내를 참고해 문의해 주세요.
                </p>
                {shopInfo?.shop_tel && (
                  <p><strong>전화:</strong> {shopInfo.shop_tel}</p>
                )}
                {shopInfo?.shop_email && (
                  <p><strong>이메일:</strong> {shopInfo.shop_email}</p>
                )}
                {shopInfo?.return_address && (
                  <p><strong>반품 주소:</strong> {shopInfo.return_address}</p>
                )}
                {(shopInfo?.return_info || shopInfo?.exchange_info) && (
                  <div className="pt-2 mt-2 border-t border-amber-200 text-xs text-muted-foreground whitespace-pre-line">
                    {shopInfo.return_info && <div>{shopInfo.return_info}</div>}
                    {shopInfo.exchange_info && <div>{shopInfo.exchange_info}</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Order history */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t('order.orderHistory')}</CardTitle>
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
          <div className="flex gap-3">
            {/* 계속 쇼핑하기 - 취소/환불 가능 상태에서 표시 */}
            {["pending", "paid", "preparing", "shipping", "delivered"].includes(order.status) && (
              <Button
                className="flex-1"
                onClick={() => router.push("/shop")}
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                {t('order.continueShopping')}
              </Button>
            )}

            {/* 주문 취소 (결제대기/결제완료 상태) - 즉시 취소 */}
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

            {/* 취소 요청 (준비중 상태) - 관리자 승인 필요 */}
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

            {/* 취소요청 중 안내 */}
            {order.status === "cancel_requested" && (
              <div className="flex-1 p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 space-y-2">
                <p className="font-medium">{t('order.cancelRequestReceived')}</p>
                <div className="text-orange-700 space-y-1">
                  <p>{t('order.requestDate', { date: formatDate(order.updatedAt) })}</p>
                  {order.cancelReason && <p>{t('order.cancelReason', { reason: order.cancelReason })}</p>}
                </div>
                <p className="text-xs text-orange-600 pt-1 border-t border-orange-200">
                  {t('order.cancelAdminNotice')}
                </p>
              </div>
            )}

            {/* 환불 요청 (배송중/배송완료 상태) */}
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

            {/* 교환 요청 (배송중/배송완료 상태) */}
            {["shipping", "delivered"].includes(order.status) && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => openDialog("exchange")}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                교환 요청
              </Button>
            )}

            {/* 환불요청 중 안내 */}
            {order.status === "refund_requested" && (
              <div className="flex-1 p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 space-y-2">
                <p className="font-medium">{t('order.refundRequestReceived')}</p>
                <div className="text-orange-700 space-y-1">
                  <p>{t('order.requestDate', { date: formatDate(order.updatedAt) })}</p>
                  {order.cancelReason && <p>{t('order.refundReason', { reason: order.cancelReason })}</p>}
                  {order.refundAmount !== null && (
                    <p>{t('order.expectedRefundLabel', { amount: formatPrice(order.refundAmount) })}</p>
                  )}
                </div>
                <p className="text-xs text-orange-600 pt-1 border-t border-orange-200">
                  {t('order.refundAdminNotice')}
                </p>
              </div>
            )}

            {/* 구매 확정 (배송완료 상태) */}
            {order.status === "delivered" && (
              <Button
                className="flex-1"
                onClick={() => openDialog("confirm")}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {t('order.confirmPurchase')}
              </Button>
            )}
          </div>
        </div>

      {/* 액션 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "cancel" && t('order.cancelOrder')}
              {dialogAction === "refund" && t('order.requestRefund')}
              {dialogAction === "exchange" && '교환 요청'}
              {dialogAction === "confirm" && t('order.confirmPurchase')}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "cancel" && t('order.cancelConfirm')}
              {dialogAction === "refund" && t('order.refundConfirm')}
              {dialogAction === "exchange" && '교환 사유를 선택해 주세요. 관리자 확인 후 진행됩니다.'}
              {dialogAction === "confirm" && t('order.purchaseConfirm')}
            </DialogDescription>
          </DialogHeader>

          {/* 준비중 상태에서 취소 요청 안내 */}
          {dialogAction === "cancel" && order?.status === "preparing" && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <p className="font-medium mb-1">{t('order.preparingNotice')}</p>
              <p>
                {t('order.preparingNoticeDetail')}
              </p>
            </div>
          )}

          {dialogAction !== "confirm" && (
            <div className="space-y-4">
              <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
                {(dialogAction === "cancel" ? cancelReasons : dialogAction === "exchange" ? [
                  '상품 불량',
                  '오배송',
                  '사이즈/색상 변경',
                  '기타',
                ] : refundReasons).map((reason) => (
                  <div key={reason} className="flex items-center space-x-2">
                    <RadioGroupItem value={reason} id={reason} />
                    <Label htmlFor={reason} className="cursor-pointer">{reason}</Label>
                  </div>
                ))}
              </RadioGroup>

              {(selectedReason === t('order.cancelReasons.other') || selectedReason === t('order.refundReasons.other') || (dialogAction === 'exchange' && selectedReason === '기타')) && (
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('address.cancel')}
            </Button>
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
                  {dialogAction === "exchange" && '교환 요청'}
                  {dialogAction === "confirm" && t('order.confirmPurchase')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
