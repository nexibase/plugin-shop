"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Loader2,
  Truck,
  XCircle,
  RotateCcw,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
} from "lucide-react"

interface ShopSettings {
  shop_name: string
  shop_tel: string
  shop_email: string
  delivery_notice: string
  refund_policy: string
  return_shipping_fee: string
  exchange_info: string
  return_info: string
  return_address: string
}

export default function ShopPolicyPage() {
  const t = useTranslations('shop')
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/shop/settings")
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
      }
    } catch (err) {
      console.error("failed to load settings:", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const returnShippingFee = settings?.return_shipping_fee
    ? parseInt(settings.return_shipping_fee).toLocaleString()
    : "5,000"

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-2">{t('policy.title')}</h1>
          <p className="text-muted-foreground mb-8">
            {t('policy.intro', { shopName: settings?.shop_name || t('title') })}
          </p>

          <div className="space-y-6">
            {/* Delivery notice */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Truck className="h-5 w-5 text-blue-500" />
                  {t('policy.shippingTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {settings?.delivery_notice ? (
                  <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                    {settings.delivery_notice}
                  </p>
                ) : (
                  <ul className="space-y-2 text-muted-foreground">
                    <li>{t('policy.shippingDetail1')}</li>
                    <li>{t('policy.shippingDetail2')}</li>
                    <li>{t('policy.shippingDetail3')}</li>
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* 주문 취소 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <XCircle className="h-5 w-5 text-red-500" />
                  {t('policy.cancelTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">{t('policy.cancelBeforeTitle')}</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>{t('policy.cancelBefore1')}</li>
                    <li>{t('policy.cancelBefore2')}</li>
                    <li>{t('policy.cancelBefore3Prefix')}<span className="text-green-600 font-medium">{t('policy.fullRefund')}</span>{t('policy.cancelBefore3Suffix')}</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">{t('policy.cancelAfterTitle')}</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>{t('policy.cancelAfter1')}</li>
                    <li>{t('policy.cancelAfter2Prefix')}<span className="text-red-600 font-medium">{t('policy.won', { amount: returnShippingFee })}</span>{t('policy.cancelAfter2Suffix')}</li>
                  </ul>
                </div>
                {settings?.refund_policy && (
                  <div className="pt-3 border-t">
                    <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                      {settings.refund_policy}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 반품 안내 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <RotateCcw className="h-5 w-5 text-orange-500" />
                  {t('policy.returnTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {settings?.return_info ? (
                  <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                    {settings.return_info}
                  </p>
                ) : (
                  <>
                    <div>
                      <h4 className="font-medium mb-2">{t('policy.returnPeriodTitle')}</h4>
                      <p className="text-muted-foreground">
                        {t('policy.returnPeriodDesc')}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">{t('policy.returnNotAllowedTitle')}</h4>
                      <ul className="space-y-1 text-muted-foreground">
                        <li>{t('policy.returnNotAllowed1')}</li>
                        <li>{t('policy.returnNotAllowed2')}</li>
                        <li>{t('policy.returnNotAllowed3')}</li>
                      </ul>
                    </div>
                  </>
                )}
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">{t('policy.returnShippingFee')}</span>{" "}
                    <span className="text-red-600 font-medium">{t('policy.won', { amount: returnShippingFee })}</span>
                    <span className="text-muted-foreground ml-1">{t('policy.simpleMindOnly')}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('policy.freeOnDefect')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 교환 안내 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <RefreshCw className="h-5 w-5 text-purple-500" />
                  {t('policy.exchangeTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {settings?.exchange_info ? (
                  <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                    {settings.exchange_info}
                  </p>
                ) : (
                  <>
                    <div>
                      <h4 className="font-medium mb-2">{t('policy.exchangePeriodTitle')}</h4>
                      <p className="text-muted-foreground">
                        {t('policy.exchangePeriodDesc')}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">{t('policy.exchangeProcessTitle')}</h4>
                      <ol className="space-y-1 text-muted-foreground list-decimal list-inside">
                        <li>{t('policy.exchangeProcess1')}</li>
                        <li>{t('policy.exchangeProcess2')}</li>
                        <li>{t('policy.exchangeProcess3')}</li>
                      </ol>
                    </div>
                  </>
                )}
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">{t('policy.exchangeShippingFee')}</span>{" "}
                    <span className="text-red-600 font-medium">{t('policy.roundTrip', { price: (parseInt(returnShippingFee.replace(/,/g, '')) * 2 || 10000).toLocaleString() })}</span>
                    <span className="text-muted-foreground ml-1">{t('policy.simpleMindOnly')}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('policy.freeOnDefect')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 반품/교환 주소 및 연락처 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-green-500" />
                  {t('policy.returnExchangeInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {settings?.return_address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('policy.returnExchangeAddress')}</p>
                      <p className="text-muted-foreground">{settings.return_address}</p>
                    </div>
                  </div>
                )}
                {settings?.shop_tel && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('policy.customerCenter')}</p>
                      <p className="text-muted-foreground">{settings.shop_tel}</p>
                    </div>
                  </div>
                )}
                {settings?.shop_email && (
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('policy.email')}</p>
                      <p className="text-muted-foreground">{settings.shop_email}</p>
                    </div>
                  </div>
                )}
                {!settings?.return_address && !settings?.shop_tel && !settings?.shop_email && (
                  <p className="text-muted-foreground">
                    {t('policy.noContactInfo')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
    </div>
  )
}
