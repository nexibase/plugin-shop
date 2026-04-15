"use client"

import { useState, useEffect } from "react"
import { useTranslations, useLocale } from 'next-intl'
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Save,
  AlertCircle,
  Trash2,
  Printer,
  ExternalLink,
} from "lucide-react"
import { DELIVERY_COMPANIES as DELIVERY_LIST, getTrackingUrlByName } from "@/plugins/shop/lib/delivery"

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
  paymentInfo: string | null
  paidAt: string | null
  trackingCompany: string | null
  trackingNumber: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelReason: string | null
  cancelledAt: string | null
  refundAmount: number | null
  refundedAt: string | null
  adminMemo: string | null
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
  user: {
    id: number
    nickname: string
    email: string
    phone: string | null
  }
}

// Map card-issuer code → i18n key
const CARD_NAMES: Record<string, string> = {
  "01": "cardIssuer.hanaKeb",
  "02": "cardIssuer.kbKookmin",
  "03": "cardIssuer.samsung",
  "04": "cardIssuer.hyundai",
  "06": "cardIssuer.lotte",
  "07": "cardIssuer.shinhan",
  "08": "cardIssuer.legacyKeb",
  "11": "cardIssuer.bc",
  "12": "cardIssuer.nhNonghyup",
  "13": "cardIssuer.hanmi",
  "14": "cardIssuer.shinsegaeHanmi",
  "15": "cardIssuer.citi",
  "16": "cardIssuer.woori",
  "17": "cardIssuer.hanaSk",
  "21": "cardIssuer.visaIntl",
  "22": "cardIssuer.masterIntl",
  "23": "cardIssuer.jcb",
  "24": "cardIssuer.amexIntl",
  "25": "cardIssuer.dinersIntl",
  "26": "cardIssuer.chinaUnionpay",
  "27": "cardIssuer.vpass",
  "28": "cardIssuer.mastercard",
  "29": "cardIssuer.discover",
  "31": "cardIssuer.skFuel",
  "32": "cardIssuer.soil",
  "33": "cardIssuer.hyundaiOilbank",
  "34": "cardIssuer.gsCaltex",
  "35": "cardIssuer.wooribc",
  "36": "cardIssuer.hipass",
  "37": "cardIssuer.savingsBank",
  "38": "cardIssuer.suhyupCard",
  "39": "cardIssuer.jeonbukBank",
  "40": "cardIssuer.gwangjuBank",
  "41": "cardIssuer.jejuBank",
  "42": "cardIssuer.kakaobanKCard",
  "43": "cardIssuer.kbankCard",
  "44": "cardIssuer.tossbankCard",
}

const STATUS_VALUES = [
  "pending", "paid", "preparing", "shipping", "delivered",
  "confirmed", "cancel_requested", "cancelled", "refund_requested", "refunded",
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

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  paid: "bg-blue-500",
  preparing: "bg-indigo-500",
  shipping: "bg-purple-500",
  delivered: "bg-green-500",
  confirmed: "bg-green-700",
  cancel_requested: "bg-orange-500",
  cancelled: "bg-gray-500",
  refund_requested: "bg-orange-500",
  refunded: "bg-red-500",
}

const DELIVERY_COMPANIES = DELIVERY_LIST.map(c => c.name)

export default function AdminOrderDetailPage() {
  const t = useTranslations('shop.admin')
  const to = useTranslations('shop.order')
  const tp = useTranslations('shop.policy')
  const tc = useTranslations('shop')
  const locale = useLocale()
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [bankInfo, setBankInfo] = useState<string | null>(null)
  const [cardInfo, setCardInfo] = useState<{
    cardName: string | null
    cardNo: string | null
    applNum: string | null
    cardQuota: string
    applDate: string | null
    applTime: string | null
    tid: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 수정 폼 상태
  const [status, setStatus] = useState("")
  const [trackingCompany, setTrackingCompany] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [adminMemo, setAdminMemo] = useState("")

  // 삭제 다이얼로그 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 취소/환불 요청 처리 상태
  const [processingAction, setProcessingAction] = useState<string | null>(null)

  // 관리자 주문 취소 다이얼로그
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")

  useEffect(() => {
    fetchOrder()
  }, [orderId])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`)
      if (!res.ok) {
        setError(t('orderNotFound'))
        return
      }
      const data = await res.json()
      setOrder(data.order)
      setBankInfo(data.bankInfo)
      setCardInfo(data.cardInfo)
      setStatus(data.order.status)
      setTrackingCompany(data.order.trackingCompany || "")
      setTrackingNumber(data.order.trackingNumber || "")
      setAdminMemo(data.order.adminMemo || "")
    } catch {
      setError(t('orderLoadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!order) return

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          trackingCompany: trackingCompany || null,
          trackingNumber: trackingNumber || null,
          adminMemo: adminMemo || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || t('saveFailedErr'))
        return
      }

      setSuccessMessage(t('saved'))
      fetchOrder()
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch {
      setError(t('saveErrorErr'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || t('deleteFailed'))
        setDeleteDialogOpen(false)
        return
      }

      router.push("/admin/shop/orders")
    } catch {
      setError(t('deleteError'))
      setDeleteDialogOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  // Confirm bank transfer deposit
  const handleConfirmPayment = async () => {
    if (!order) return

    if (!confirm(t('confirmDepositQuestion'))) {
      return
    }

    setProcessingAction("confirm_payment")
    setError(null)

    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_payment",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('confirmDepositFailed'))
        return
      }

      setSuccessMessage(t('confirmDepositSuccess'))
      fetchOrder()
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch {
      setError(t('confirmDepositError'))
    } finally {
      setProcessingAction(null)
    }
  }

  // 취소/환불 요청 처리 (승인/거절)
  const handleRequestAction = async (action: "approve" | "reject", requestType: "cancel" | "refund") => {
    if (!order) return

    const actionLabel = action === "approve" ? t('actionApprove') : t('actionReject')
    const typeLabel = requestType === "cancel" ? t('cancelRequestText') : t('refundRequestText')

    // 승인 시 카드 결제 안내 메시지 추가
    let confirmMessage = t('confirmActionPrompt', { type: typeLabel, action: actionLabel })
    if (action === "approve" && order.paymentMethod === "card") {
      confirmMessage += t('cardPgCancelNotice')
    }

    if (!confirm(confirmMessage)) {
      return
    }

    setProcessingAction(`${requestType}_${action}`)
    setError(null)

    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: `${requestType}_${action}`,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('actionFailed', { action: actionLabel }))
        return
      }

      // 카드 결제 취소/환불 결과 메시지 생성
      let message = t('actionResultSuccess', { type: typeLabel, action: actionLabel })
      if (action === "approve" && data.pgCancelResult) {
        if (data.pgCancelResult.success) {
          message += t('cardCancelDone')
        } else {
          message += t('cardCancelFailed', { msg: data.pgCancelResult.message })
        }
      }

      setSuccessMessage(message)
      fetchOrder()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch {
      setError(t('actionError', { action: actionLabel }))
    } finally {
      setProcessingAction(null)
    }
  }

  // 관리자 주문 취소 처리
  const handleAdminCancel = async () => {
    if (!order || !cancelReason.trim()) return

    // 카드 결제 안내 메시지
    let confirmMessage = t('orderCanceledConfirm', { orderNo: order.orderNo, reason: cancelReason })
    if (order.paymentMethod === "card") {
      confirmMessage += t('cardPgCancelNotice')
    }

    if (!confirm(confirmMessage)) {
      return
    }

    setProcessingAction("admin_cancel")
    setError(null)

    try {
      const res = await fetch(`/api/admin/shop/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "admin_cancel",
          cancelReason: cancelReason.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('orderCancelFailed'))
        return
      }

      // 성공 메시지
      let message = t('orderCanceledMsg')
      if (data.pgCancelResult) {
        if (data.pgCancelResult.success) {
          message += t('cardCancelDone')
        } else {
          message += t('cardCancelFailed', { msg: data.pgCancelResult.message })
        }
      }

      setSuccessMessage(message)
      setCancelDialogOpen(false)
      setCancelReason("")
      fetchOrder()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch {
      setError(t('orderCancelError'))
    } finally {
      setProcessingAction(null)
    }
  }

  const formatPrice = (price: number) => tp('won', { amount: price.toLocaleString() })
  const formatDate = (date: string | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleString(locale)
  }

  // paymentInfo에서 취소/환불 정보 파싱
  const getPaymentCancelInfo = () => {
    if (!order?.paymentInfo) return null
    try {
      const data = JSON.parse(order.paymentInfo)
      return data.cancelInfo || data.refundInfo || null
    } catch {
      return null
    }
  }
  const cancelInfo = order ? getPaymentCancelInfo() : null

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="text-center py-20">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push("/admin/shop/orders")}>
              {t('backToList')}
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (!order) return null

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/admin/shop/orders")}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t('list')}
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t('orderDetail')}</h1>
            <p className="text-muted-foreground font-mono">{order.orderNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_COLORS[order.status] || "bg-gray-500"}>
            {STATUS_I18N_KEY[order.status] ? to(STATUS_I18N_KEY[order.status]) : order.status}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/admin/shop/orders/${order.id}/label`, '_blank')}
          >
            <Printer className="h-4 w-4 mr-1" />
            {t('printLabel')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {t('deleteBtn')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽 컬럼 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {t('orderItemsCard')}
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
                  <div className="flex-1">
                    {item.productSlug ? (
                      <Link href={`/shop/products/${item.productSlug}`} target="_blank" className="hover:text-primary">
                        <h3 className="font-medium">{item.productName}</h3>
                      </Link>
                    ) : (
                      <h3 className="font-medium">{item.productName}</h3>
                    )}
                    {item.optionText && (
                      <p className="text-sm text-muted-foreground">{item.optionText}</p>
                    )}
                    <p className="text-sm">
                      {formatPrice(item.price)} × {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(item.subtotal)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Customer info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('ordererInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex">
                <span className="w-24 text-muted-foreground">{t('orderer')}</span>
                <span>{order.ordererName}</span>
              </div>
              <div className="flex">
                <span className="w-24 text-muted-foreground">{t('phoneLabel')}</span>
                <span>{order.ordererPhone}</span>
              </div>
              {order.ordererEmail && (
                <div className="flex">
                  <span className="w-24 text-muted-foreground">{t('emailLabel')}</span>
                  <span>{order.ordererEmail}</span>
                </div>
              )}
              <div className="border-t pt-2 mt-2">
                <div className="flex">
                  <span className="w-24 text-muted-foreground">{t('memberInfo')}</span>
                  <span>
                    {order.user.nickname} ({order.user.email})
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {t('shippingInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex">
                <span className="w-24 text-muted-foreground">{t('recipientLabel')}</span>
                <span>{order.recipientName}</span>
              </div>
              <div className="flex">
                <span className="w-24 text-muted-foreground">{t('phoneLabel')}</span>
                <span>{order.recipientPhone}</span>
              </div>
              <div className="flex">
                <span className="w-24 text-muted-foreground">{t('addressLabel')}</span>
                <span>
                  [{order.zipCode}] {order.address}
                  {order.addressDetail && ` ${order.addressDetail}`}
                </span>
              </div>
              {order.deliveryMemo && (
                <div className="flex">
                  <span className="w-24 text-muted-foreground">{t('deliveryMemo')}</span>
                  <span>{order.deliveryMemo}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t('paymentInfoCard')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('productAmount')}</span>
                <span>{formatPrice(order.totalPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('shippingFee')}</span>
                <span>{formatPrice(order.deliveryFee)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">{t('totalPayment')}</span>
                <span className="text-lg font-bold text-primary">
                  {formatPrice(order.finalPrice)}
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-muted-foreground">{t('paymentMethod')}</span>
                <span>{order.paymentMethod === "bank" ? t('bankTransfer') : t('cardPayment')}</span>
              </div>
              {order.paidAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('paymentDate')}</span>
                  <span>{formatDate(order.paidAt)}</span>
                </div>
              )}

              {/* 카드 결제 정보 */}
              {cardInfo && (
                <div className="pt-3 mt-3 border-t space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t('cardPaymentInfo')}</p>
                  {cardInfo.cardName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('cardCompany')}</span>
                      <span>{CARD_NAMES[cardInfo.cardName] ? tc(CARD_NAMES[cardInfo.cardName] as any) : cardInfo.cardName}</span>
                    </div>
                  )}
                  {cardInfo.cardNo && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('cardNumber')}</span>
                      <span className="font-mono">{cardInfo.cardNo}</span>
                    </div>
                  )}
                  {cardInfo.applNum && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('approvalNumber')}</span>
                      <span className="font-mono">{cardInfo.applNum}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('installment')}</span>
                    <span>{cardInfo.cardQuota === "00" ? t('lumpSum') : t('months', { count: cardInfo.cardQuota })}</span>
                  </div>
                  {cardInfo.tid && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('tid')}</span>
                      <span className="font-mono text-xs">{cardInfo.tid}</span>
                    </div>
                  )}
                </div>
              )}

              {order.refundAmount && (
                <div className="flex justify-between text-red-500">
                  <span>{t('refundAmount')}</span>
                  <span>{formatPrice(order.refundAmount)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 취소/환불 사유 및 PG 처리 이력 */}
          {(order.cancelReason || cancelInfo) && (
            <Card>
              <CardHeader>
                <CardTitle>{t('cancelRefundInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.cancelReason && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{t('reason')}</p>
                    <p className="text-sm">{order.cancelReason}</p>
                  </div>
                )}
                {order.cancelledAt && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{t('cancelDate')}</p>
                    <p className="text-sm">{formatDate(order.cancelledAt)}</p>
                  </div>
                )}
                {order.refundedAt && order.status === 'refunded' && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{t('refundDate')}</p>
                    <p className="text-sm">{formatDate(order.refundedAt)}</p>
                  </div>
                )}
                {cancelInfo && (
                  <div className="pt-3 border-t">
                    <p className="text-sm font-medium text-muted-foreground mb-2">{t('pgHistory')}</p>
                    <div className="text-xs space-y-1 bg-muted/50 p-3 rounded-lg">
                      <p>
                        <span className="text-muted-foreground">{t('handler')}</span>{" "}
                        {cancelInfo.cancelledBy === 'admin' ? t('handlerAdmin') : t('handlerCustomer')}
                      </p>
                      <p>
                        <span className="text-muted-foreground">{t('handledAt')}</span>{" "}
                        {cancelInfo.cancelledAt || cancelInfo.refundedAt
                          ? formatDate(cancelInfo.cancelledAt || cancelInfo.refundedAt)
                          : '-'}
                      </p>
                      {cancelInfo.pgResult && (
                        <>
                          <p>
                            <span className="text-muted-foreground">{t('pgResult')}</span>{" "}
                            <span className={cancelInfo.pgResult.success ? 'text-green-600' : 'text-red-600'}>
                              {cancelInfo.pgResult.success ? t('success') : t('failed')}
                            </span>
                            {cancelInfo.pgResult.message && ` (${cancelInfo.pgResult.message})`}
                          </p>
                          {cancelInfo.pgResult.data?.tid && (
                            <p>
                              <span className="text-muted-foreground">TID:</span>{" "}
                              {cancelInfo.pgResult.data.tid}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 오른쪽 컬럼 - 상태 관리 */}
        <div className="space-y-6">
          {/* 주문 상태 변경 */}
          <Card>
            <CardHeader>
              <CardTitle>{t('orderStatusManage')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('orderStatusLabel')}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_VALUES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {to(STATUS_I18N_KEY[v])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 배송 정보 (배송중일 때) */}
              {(status === "shipping" || status === "delivered") && (
                <>
                  <div>
                    <Label>{t('carrier')}</Label>
                    <Select value={trackingCompany} onValueChange={setTrackingCompany}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('carrierSelect')} />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERY_COMPANIES.map((company) => (
                          <SelectItem key={company} value={company}>
                            {company}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('trackingNumber')}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder={t('trackingNumberPlaceholder')}
                      />
                      {trackingCompany && trackingNumber && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const url = getTrackingUrlByName(trackingCompany, trackingNumber)
                            if (url) window.open(url, '_blank')
                          }}
                          title={t('trackOrder')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label>{t('adminMemo')}</Label>
                <Textarea
                  value={adminMemo}
                  onChange={(e) => setAdminMemo(e.target.value)}
                  placeholder={t('adminMemoPlaceholder')}
                  rows={4}
                />
              </div>

              {/* 무통장입금 입금확인 버튼 */}
              {order.paymentMethod === "bank" && order.status === "pending" && (
                <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg space-y-3">
                  <p className="text-sm font-medium text-primary">
                    {t('bankOrder')}
                  </p>
                  {bankInfo && (
                    <div className="p-3 bg-background rounded border text-sm">
                      <p className="text-xs text-muted-foreground mb-1">{t('bankAccount')}</p>
                      <p className="whitespace-pre-line">{bankInfo}</p>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {t('confirmPaymentPrompt')}
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => handleConfirmPayment()}
                    disabled={!!processingAction}
                  >
                    {processingAction === "confirm_payment" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    {t('confirmPayment')}
                  </Button>
                </div>
              )}

              {/* 취소 요청 처리 버튼 */}
              {order.status === "cancel_requested" && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                  <p className="text-sm font-medium text-orange-800">
                    {t('customerCancelRequest')}
                  </p>
                  {order.cancelReason && (
                    <p className="text-sm text-orange-700">{t('reasonLabel', { reason: order.cancelReason })}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRequestAction("approve", "cancel")}
                      disabled={!!processingAction}
                      className="flex-1"
                    >
                      {processingAction === "cancel_approve" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t('approveCancel')
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequestAction("reject", "cancel")}
                      disabled={!!processingAction}
                      className="flex-1"
                    >
                      {processingAction === "cancel_reject" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t('rejectBackToShipping')
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* 환불 요청 처리 버튼 */}
              {order.status === "refund_requested" && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                  <p className="text-sm font-medium text-orange-800">
                    {t('customerRefundRequest')}
                  </p>
                  {order.cancelReason && (
                    <p className="text-sm text-orange-700">{t('reasonLabel', { reason: order.cancelReason })}</p>
                  )}
                  {order.refundAmount && (
                    <p className="text-sm text-orange-700">
                      {t('expectedRefund', { amount: formatPrice(order.refundAmount) })}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRequestAction("approve", "refund")}
                      disabled={!!processingAction}
                      className="flex-1"
                    >
                      {processingAction === "refund_approve" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t('approveRefund')
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequestAction("reject", "refund")}
                      disabled={!!processingAction}
                      className="flex-1"
                    >
                      {processingAction === "refund_reject" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t('reject')
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-100 text-red-800 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="flex items-center gap-2 p-3 bg-green-100 text-green-800 rounded-lg text-sm">
                  <Package className="h-4 w-4" />
                  {successMessage}
                </div>
              )}

              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t('save')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Order history */}
          <Card>
            <CardHeader>
              <CardTitle>{t('orderHistoryCard')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('orderDate')}</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
              {order.paidAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('paymentDate')}</span>
                  <span>{formatDate(order.paidAt)}</span>
                </div>
              )}
              {order.shippedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('shippingStarted')}</span>
                  <span>{formatDate(order.shippedAt)}</span>
                </div>
              )}
              {order.deliveredAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('deliveryCompleted')}</span>
                  <span>{formatDate(order.deliveredAt)}</span>
                </div>
              )}
              {order.cancelledAt && (
                <div className="flex justify-between text-red-500">
                  <span>{t('cancelDate')}</span>
                  <span>{formatDate(order.cancelledAt)}</span>
                </div>
              )}
              {order.refundedAt && (
                <div className="flex justify-between text-red-500">
                  <span>{t('refundDate')}</span>
                  <span>{formatDate(order.refundedAt)}</span>
                </div>
              )}

              {/* 관리자 주문 취소 버튼 (취소/환불 상태가 아닌 경우) */}
              {!["cancelled", "refunded", "cancel_requested", "refund_requested"].includes(order.status) && (
                <div className="pt-4 mt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={!!processingAction}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    {t('adminCancelOrder')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteOrderTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteOrderConfirm', { orderNo: order.orderNo })}
              <br />
              {t('deleteIrreversible')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('deleteBtn')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 관리자 주문 취소 다이얼로그 */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adminCancelTitle')}</DialogTitle>
            <DialogDescription>
              {t('adminCancelDescription', { name: order.ordererName, orderNo: order.orderNo })}
              <br />
              {t('cancelReasonCustomerNotice')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="cancelReason">{t('cancelReasonLabel')}</Label>
            <Textarea
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t('cancelReasonPlaceholder')}
              rows={3}
              className="mt-2"
            />
            {order.paymentMethod === "card" && (
              <p className="text-xs text-orange-600 mt-2">
                {t('cardCancelPgNotice')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false)
                setCancelReason("")
              }}
            >
              {t('close')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleAdminCancel}
              disabled={!cancelReason.trim() || processingAction === "admin_cancel"}
            >
              {processingAction === "admin_cancel" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t('cancelOrderBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </main>
    </div>
  )
}
