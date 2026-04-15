"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Loader2,
  XCircle,
  AlertCircle,
} from "lucide-react"

interface OrderItem {
  productSlug: string | null
  optionText: string | null
}

export default function OrderCompletePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <OrderCompleteContent />
    </Suspense>
  )
}

function OrderCompleteContent() {
  const t = useTranslations('shop')
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderNo = searchParams.get("orderNo")
  const paymentError = searchParams.get("error")
  const errorMessage = searchParams.get("message")

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 결제 에러가 있는 경우 에러 화면 표시
    if (paymentError) {
      setLoading(false)
      return
    }

    if (!orderNo) {
      router.push("/shop")
      return
    }

    // Clear cart then redirect to the order detail page
    clearCartAndRedirect()
  }, [orderNo, paymentError, errorMessage, router])

  // Clear cart then redirect to the order detail page
  const clearCartAndRedirect = async () => {
    try {
      const res = await fetch(`/api/shop/orders/${orderNo}`)
      if (res.ok) {
        const data = await res.json()
        if (data.order) {
          clearOrderedItemsFromCart(data.order.items)
        }
      }
    } catch (err) {
      console.error("failed to clear cart:", err)
    }
    // 주문 상세 페이지로 리다이렉트
    router.replace(`/shop/orders/${orderNo}`)
  }

  // 주문한 상품을 장바구니에서 삭제
  const clearOrderedItemsFromCart = (orderedItems: OrderItem[]) => {
    try {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]")
      const orderedKeys = new Set(
        orderedItems.map(item => `${item.productSlug || ""}-${item.optionText || ""}`)
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newCart = cart.filter((item: any) => {
        const key = `${item.productSlug || ""}-${item.optionText || ""}`
        return !orderedKeys.has(key)
      })

      localStorage.setItem("cart", JSON.stringify(newCart))
      localStorage.removeItem("orderItems")
      window.dispatchEvent(new Event("cartUpdated"))
    } catch (err) {
      console.error("failed to clear cart:", err)
    }
  }

  // 로딩 중
  if (loading && !paymentError) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 결제 실패 화면
  if (paymentError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('order.paymentFailed')}</h1>
          <p className="text-muted-foreground">
            {errorMessage || t('order.paymentFailedMessage')}
          </p>
        </div>

        <Card className="mb-6 border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-lg flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              {t('order.paymentFailedTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm mb-4">
              {t('order.paymentFailedDetail')}
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>{t('order.paymentFailedCheck1')}</li>
              <li>{t('order.paymentFailedCheck2')}</li>
              <li>{t('order.paymentFailedCheck3')}</li>
            </ul>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/shop")}
          >
            {t('continueShopping')}
          </Button>
          <Button
            className="flex-1"
            onClick={() => router.push("/shop/cart")}
          >
            {t('order.backToCart')}
          </Button>
        </div>
      </div>
    )
  }

  // 기본 로딩 화면 (리다이렉트 전)
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
