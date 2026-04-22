"use client"

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Loader2,
  Save,
  Settings,
  Building2,
  Truck,
  FileText,
  AlertCircle,
  Check,
  CreditCard,
  RotateCcw,
  Eye,
  EyeOff,
  Bell,
} from "lucide-react"
import { Sidebar } from "@/components/admin/Sidebar"

interface ShopSettings {
  shop_name: string
  shop_tel: string
  shop_email: string
  bank_info: string
  delivery_notice: string
  refund_policy: string
  return_shipping_fee: string  // 반품 배송비
  exchange_info: string  // 교환 안내
  return_info: string  // 반품 안내
  return_address: string  // 반품 주소
  option1_name: string
  option2_name: string
  option3_name: string
  // PG settings
  pg_provider: string
  pg_mid: string
  pg_signkey: string
  pg_apikey: string  // 결제 취소용 API Key
  pg_test_mode: string
  // Payment gateway activation (Phase 1 fulfillment)
  enabled_payment_gateways: string  // JSON array string, e.g. '["inicis","bank_deposit"]'
  default_card_gateway: string  // adapter id, e.g. 'inicis'
  // Notification settings
  order_notification_target: string  // admin, manager, both, none
  email_notification_enabled: string  // true, false
}

const DEFAULT_SETTINGS_BASE = {
  shop_name: "",
  shop_tel: "",
  shop_email: "",
  bank_info: "",
  delivery_notice: "",
  refund_policy: "",
  return_shipping_fee: "5000",  // 기본 반품 배송비 5,000원
  exchange_info: "",
  return_info: "",
  return_address: "",
  // PG settings
  pg_provider: "inicis",
  pg_mid: "",
  pg_signkey: "",
  pg_apikey: "",
  pg_test_mode: "true",
  // Payment gateway activation
  enabled_payment_gateways: '["inicis","bank_deposit"]',
  default_card_gateway: "inicis",
  // Notification settings
  order_notification_target: "admin",  // 기본값: 관리자만
  email_notification_enabled: "false",  // 기본값: 비활성화
}

const AVAILABLE_ADAPTERS = [
  { id: "inicis", displayName: "이니시스 (카드/계좌이체/가상계좌/휴대폰)", cardCapable: true },
  { id: "bank_deposit", displayName: "무통장입금", cardCapable: false },
]

export default function ShopSettingsPage() {
  const t = useTranslations('shop.admin')
  const tShop = useTranslations('shop')
  const DEFAULT_SETTINGS: ShopSettings = {
    ...DEFAULT_SETTINGS_BASE,
    option1_name: tShop('optionDefault.color'),
    option2_name: tShop('optionDefault.size'),
    option3_name: tShop('optionDefault.material'),
  }
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showSignKey, setShowSignKey] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/shop/settings")
      if (res.ok) {
        const data = await res.json()
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
      }
    } catch (err) {
      console.error("failed to load settings:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch("/api/admin/shop/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || t('saveFailedErr'))
        return
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch {
      setError(t('saveErrorErr'))
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key: keyof ShopSettings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-muted/30">
        <Sidebar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            {t('shopSettingsTitle')}
          </h1>
          <p className="text-muted-foreground">
            {t('settingsTitleDesc')}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
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
      </div>

      {/* Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-100 text-red-800 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-100 text-green-800 rounded-lg">
          <Check className="h-4 w-4" />
          {t('settingsSaved')}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t('basicInfo')}
            </CardTitle>
            <CardDescription>
              {t('basicInfoDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="shop_name">{t('shopName')}</Label>
              <Input
                id="shop_name"
                value={settings.shop_name}
                onChange={(e) => handleChange("shop_name", e.target.value)}
                placeholder={t('shopNamePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="shop_tel">{t('shopTel')}</Label>
              <Input
                id="shop_tel"
                value={settings.shop_tel}
                onChange={(e) => handleChange("shop_tel", e.target.value)}
                placeholder={t('shopTelPlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="shop_email">{t('shopEmail')}</Label>
              <Input
                id="shop_email"
                type="email"
                value={settings.shop_email}
                onChange={(e) => handleChange("shop_email", e.target.value)}
                placeholder={t('shopEmailPlaceholder')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t('paymentInfo')}
            </CardTitle>
            <CardDescription>
              {t('paymentInfoDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="bank_info">{t('bankInfoLabel')}</Label>
              <Textarea
                id="bank_info"
                value={settings.bank_info}
                onChange={(e) => handleChange("bank_info", e.target.value)}
                placeholder={t('bankInfoPlaceholder')}
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('bankInfoHint')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Delivery notice */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {t('deliveryNotice')}
            </CardTitle>
            <CardDescription>
              {t('deliveryNoticeDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="delivery_notice">{t('deliveryNoticeLabel')}</Label>
              <Textarea
                id="delivery_notice"
                value={settings.delivery_notice}
                onChange={(e) => handleChange("delivery_notice", e.target.value)}
                placeholder={t('deliveryNoticePlaceholder')}
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        {/* 환불 정책 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('refundPolicy')}
            </CardTitle>
            <CardDescription>
              {t('refundPolicyDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="return_shipping_fee">{t('returnShippingFeeLabel')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="return_shipping_fee"
                  type="number"
                  value={settings.return_shipping_fee}
                  onChange={(e) => handleChange("return_shipping_fee", e.target.value)}
                  placeholder="5000"
                  className="max-w-[150px]"
                />
                <span className="text-sm text-muted-foreground">{t('wonSuffix')}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('returnShippingFeeHint')}
              </p>
            </div>
            <div>
              <Label htmlFor="refund_policy">{t('refundPolicyLabel')}</Label>
              <Textarea
                id="refund_policy"
                value={settings.refund_policy}
                onChange={(e) => handleChange("refund_policy", e.target.value)}
                placeholder={t('refundPolicyPlaceholder')}
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        {/* 반품/교환 안내 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              {t('returnExchangeInfo')}
            </CardTitle>
            <CardDescription>
              {t('returnExchangeDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="exchange_info">{t('exchangeInfoLabel')}</Label>
                <Textarea
                  id="exchange_info"
                  value={settings.exchange_info}
                  onChange={(e) => handleChange("exchange_info", e.target.value)}
                  placeholder={t('exchangeInfoPlaceholder')}
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="return_info">{t('returnInfoLabel')}</Label>
                <Textarea
                  id="return_info"
                  value={settings.return_info}
                  onChange={(e) => handleChange("return_info", e.target.value)}
                  placeholder={t('returnInfoPlaceholder')}
                  rows={4}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="return_address">{t('returnAddressLabel')}</Label>
              <Input
                id="return_address"
                value={settings.return_address}
                onChange={(e) => handleChange("return_address", e.target.value)}
                placeholder={t('returnAddressPlaceholder')}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('returnAddressHint')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 옵션명 설정 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t('optionNameSettings')}
            </CardTitle>
            <CardDescription>
              {t('optionNameSettingsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="option1_name">{t('optionName1')}</Label>
                <Input
                  id="option1_name"
                  value={settings.option1_name}
                  onChange={(e) => handleChange("option1_name", e.target.value)}
                  placeholder={t('optionExample1')}
                />
              </div>
              <div>
                <Label htmlFor="option2_name">{t('optionName2')}</Label>
                <Input
                  id="option2_name"
                  value={settings.option2_name}
                  onChange={(e) => handleChange("option2_name", e.target.value)}
                  placeholder={t('optionExample2')}
                />
              </div>
              <div>
                <Label htmlFor="option3_name">{t('optionName3')}</Label>
                <Input
                  id="option3_name"
                  value={settings.option3_name}
                  onChange={(e) => handleChange("option3_name", e.target.value)}
                  placeholder={t('optionExample3')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PG 결제 설정 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t('pgSettings')}
            </CardTitle>
            <CardDescription>
              {t('pgSettingsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pg_mid">{t('merchantId')}</Label>
                <Input
                  id="pg_mid"
                  value={settings.pg_mid}
                  onChange={(e) => handleChange("pg_mid", e.target.value)}
                  placeholder={t('merchantIdPlaceholder')}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('merchantIdHint')}
                </p>
              </div>
              <div>
                <Label htmlFor="pg_signkey">SignKey</Label>
                <div className="relative">
                  <Input
                    id="pg_signkey"
                    type={showSignKey ? "text" : "password"}
                    value={settings.pg_signkey}
                    onChange={(e) => handleChange("pg_signkey", e.target.value)}
                    placeholder={t('signKeyPlaceholder')}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignKey(!showSignKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showSignKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('signKeyHint')}
                </p>
              </div>
              <div>
                <Label htmlFor="pg_apikey">{t('apiKeyLabel')}</Label>
                <div className="relative">
                  <Input
                    id="pg_apikey"
                    type={showApiKey ? "text" : "password"}
                    value={settings.pg_apikey}
                    onChange={(e) => handleChange("pg_apikey", e.target.value)}
                    placeholder={t('apiKeyPlaceholder')}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('apiKeyHint')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pg_test_mode"
                checked={settings.pg_test_mode === "true"}
                onChange={(e) => handleChange("pg_test_mode", e.target.checked ? "true" : "false")}
                className="rounded"
              />
              <label htmlFor="pg_test_mode" className="text-sm cursor-pointer">
                {t('testMode')}
              </label>
            </div>
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400 mb-2">{t('testModeInfo')}</p>
              <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 space-y-1">
                <li>{t('testModeItem1')} <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono text-amber-800 dark:text-amber-200">INIpayTest</code></li>
                <li>{t('testModeItem2')} <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono text-amber-800 dark:text-amber-200">ItEQKi3rY7uvDS8l</code></li>
                <li>{t('testModeItem3')}</li>
                <li>{t('testModeItem4')}</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 활성 결제수단 (Phase 1 fulfillment) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              활성 결제수단
            </CardTitle>
            <CardDescription>
              체크아웃에서 고객에게 노출할 결제수단을 선택하세요. 카드 PG가 여러 개인 경우 기본값도 선택합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              let enabled: string[]
              try {
                enabled = JSON.parse(settings.enabled_payment_gateways || '["inicis","bank_deposit"]')
              } catch {
                enabled = ['inicis', 'bank_deposit']
              }
              const toggle = (id: string) => {
                const next = enabled.includes(id) ? enabled.filter(x => x !== id) : [...enabled, id]
                handleChange('enabled_payment_gateways', JSON.stringify(next))
                // If disabling the current default card gateway, clear it
                if (!next.includes(settings.default_card_gateway)) {
                  const fallback = AVAILABLE_ADAPTERS.find(a => a.cardCapable && next.includes(a.id))
                  handleChange('default_card_gateway', fallback?.id ?? '')
                }
              }
              const cardCapableEnabled = AVAILABLE_ADAPTERS.filter(a => a.cardCapable && enabled.includes(a.id))
              return (
                <>
                  <div className="space-y-2">
                    {AVAILABLE_ADAPTERS.map(a => (
                      <label key={a.id} className="flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={enabled.includes(a.id)}
                          onChange={() => toggle(a.id)}
                          className="rounded"
                        />
                        <div className="flex-1">
                          <span className="font-medium">{a.displayName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{a.id}</span>
                        </div>
                        {a.cardCapable && <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">카드 PG</span>}
                      </label>
                    ))}
                  </div>

                  {cardCapableEnabled.length > 1 && (
                    <div className="pt-2 border-t">
                      <Label className="mb-2 block">기본 카드 PG</Label>
                      <div className="space-y-2">
                        {cardCapableEnabled.map(a => (
                          <label key={a.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="default_card_gateway"
                              checked={settings.default_card_gateway === a.id}
                              onChange={() => handleChange('default_card_gateway', a.id)}
                            />
                            <span>{a.displayName}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </CardContent>
        </Card>

        {/* 주문 알림 설정 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('orderNotificationSettings')}
            </CardTitle>
            <CardDescription>
              {t('orderNotificationDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="order_notification_target">{t('notificationTarget')}</Label>
              <select
                id="order_notification_target"
                value={settings.order_notification_target}
                onChange={(e) => handleChange("order_notification_target", e.target.value)}
                className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="admin">{t('notifAdmin')}</option>
                <option value="manager">{t('notifManager')}</option>
                <option value="both">{t('notifBoth')}</option>
                <option value="none">{t('notifNone')}</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {t('notifTargetHint')}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
              <input
                type="checkbox"
                id="email_notification_enabled"
                checked={settings.email_notification_enabled === "true"}
                onChange={(e) => handleChange("email_notification_enabled", e.target.checked ? "true" : "false")}
                className="rounded"
              />
              <label htmlFor="email_notification_enabled" className="text-sm cursor-pointer">
                {t('emailNotification')}
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('emailNotificationHint')}
              <br />
              {t('smtpRequired')}
            </p>
          </CardContent>
        </Card>
      </div>
        </div>
      </main>
    </div>
  )
}
