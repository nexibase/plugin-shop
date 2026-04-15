"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from 'next-intl'
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
  Truck,
  Check,
  MapPin,
} from "lucide-react"

interface DeliveryFee {
  id: number
  name: string
  regions: string[]
  fee: number
  freeAmount: number | null
  isDefault: boolean
  isActive: boolean
  sortOrder: number
}

// 배송비 정책 모달
function DeliveryModal({
  isOpen,
  onClose,
  delivery,
  onSave
}: {
  isOpen: boolean
  onClose: () => void
  delivery: DeliveryFee | null
  onSave: (data: Partial<DeliveryFee>) => void
}) {
  const t = useTranslations('shop.admin')
  const [formData, setFormData] = useState({
    name: '',
    regions: '',
    fee: '',
    freeAmount: '',
    isDefault: false,
    isActive: true,
    sortOrder: 0
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (delivery) {
      setFormData({
        name: delivery.name,
        regions: delivery.regions.join('\n'),
        fee: String(delivery.fee),
        freeAmount: delivery.freeAmount ? String(delivery.freeAmount) : '',
        isDefault: delivery.isDefault,
        isActive: delivery.isActive,
        sortOrder: delivery.sortOrder
      })
    } else {
      setFormData({
        name: '',
        regions: '',
        fee: '',
        freeAmount: '',
        isDefault: false,
        isActive: true,
        sortOrder: 0
      })
    }
  }, [delivery, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const regions = formData.regions
      .split('\n')
      .map(r => r.trim())
      .filter(Boolean)

    await onSave({
      ...(delivery && { id: delivery.id }),
      name: formData.name,
      regions,
      fee: parseInt(formData.fee) || 0,
      freeAmount: formData.freeAmount ? parseInt(formData.freeAmount) : null,
      isDefault: formData.isDefault,
      isActive: formData.isActive,
      sortOrder: formData.sortOrder
    })
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {delivery ? t('editDeliveryPolicy') : t('addDeliveryPolicy')}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <Label htmlFor="name">{t('policyNameRequired')}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('policyNamePlaceholder')}
              required
            />
          </div>

          <div>
            <Label htmlFor="fee">{t('deliveryFeeRequired')}</Label>
            <Input
              id="fee"
              type="number"
              value={formData.fee}
              onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
              placeholder="0"
              required
            />
          </div>

          <div>
            <Label htmlFor="freeAmount">{t('freeAmountLabel')}</Label>
            <Input
              id="freeAmount"
              type="number"
              value={formData.freeAmount}
              onChange={(e) => setFormData({ ...formData, freeAmount: e.target.value })}
              placeholder={t('freeAmountPlaceholder')}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('freeAmountHint')}
            </p>
          </div>

          <div>
            <Label htmlFor="regions">{t('regionsLabel')}</Label>
            <textarea
              id="regions"
              value={formData.regions}
              onChange={(e) => setFormData({ ...formData, regions: e.target.value })}
              className="w-full min-h-[120px] p-3 border rounded-md bg-background text-sm"
              placeholder={t('regionsPlaceholder')}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('regionsHint')}
            </p>
          </div>

          <div>
            <Label htmlFor="sortOrder">{t('sortOrder')}</Label>
            <Input
              id="sortOrder"
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="isDefault">{t('setAsDefault')}</Label>
              <p className="text-xs text-muted-foreground">{t('setAsDefaultHint')}</p>
            </div>
            <Switch
              id="isDefault"
              checked={formData.isDefault}
              onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">{t('activate')}</Label>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {delivery ? t('edit') : t('add')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ShopDeliveryPage() {
  const t = useTranslations('shop.admin')
  const tp = useTranslations('shop.policy')
  const tShop = useTranslations('shop')
  const [deliveryFees, setDeliveryFees] = useState<DeliveryFee[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDelivery, setEditingDelivery] = useState<DeliveryFee | null>(null)

  const fetchDeliveryFees = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shop/delivery')
      if (res.ok) {
        const data = await res.json()
        setDeliveryFees(data.deliveryFees)
      }
    } catch (error) {
      console.error('배송비 정책 조회 에러:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeliveryFees()
  }, [fetchDeliveryFees])

  const handleSave = async (data: Partial<DeliveryFee>) => {
    try {
      const method = data.id ? 'PUT' : 'POST'
      const res = await fetch('/api/admin/shop/delivery', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        setModalOpen(false)
        setEditingDelivery(null)
        fetchDeliveryFees()
      } else {
        const error = await res.json()
        alert(error.error || t('saveFailed'))
      }
    } catch (error) {
      console.error('save error:', error)
      alert(t('saveError'))
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('deletePolicyConfirm'))) return

    try {
      const res = await fetch(`/api/admin/shop/delivery?ids=${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        fetchDeliveryFees()
      } else {
        const error = await res.json()
        alert(error.error || t('deleteFailed'))
      }
    } catch (error) {
      console.error('delete error:', error)
      alert(t('deleteError'))
    }
  }

  // 기본 배송비 정책 생성
  const handleCreateDefaults = async () => {
    if (!confirm(t('createDefaultPolicyConfirm'))) return

    const defaults = [
      { name: tShop('deliveryZone.default'), fee: 3000, freeAmount: 50000, regions: [], isDefault: true, sortOrder: 0 },
      { name: tShop('deliveryZone.jeju'), fee: 6000, freeAmount: 50000, regions: ['63000-63644'], sortOrder: 1 },
      { name: tShop('deliveryZone.remote'), fee: 8000, freeAmount: null, regions: ['23000-23010', '40200-40240'], sortOrder: 2 }
    ]

    for (const policy of defaults) {
      await fetch('/api/admin/shop/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy)
      })
    }

    fetchDeliveryFees()
  }

  const formatPrice = (price: number) => tp('won', { amount: price.toLocaleString() })

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">{t('deliveryPolicyTitle')}</h1>
              <p className="text-muted-foreground">{t('deliveryDesc')}</p>
            </div>
            <div className="flex gap-2">
              {deliveryFees.length === 0 && (
                <Button variant="outline" onClick={handleCreateDefaults}>
                  {t('createDefaultPolicy')}
                </Button>
              )}
              <Button onClick={() => { setEditingDelivery(null); setModalOpen(true) }}>
                <Plus className="h-4 w-4 mr-2" />
                {t('addPolicy')}
              </Button>
            </div>
          </div>

          {/* Help message */}
          <Card className="mb-6 bg-muted/50">
            <CardContent className="p-4">
              <h3 className="font-medium mb-2">{t('deliveryCalcTitle')}</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>{t('deliveryCalc1')}</li>
                <li>{t('deliveryCalc2')}</li>
                <li>{t('deliveryCalc3')}</li>
                <li>{t('deliveryCalc4')}</li>
              </ul>
            </CardContent>
          </Card>

          {/* 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  {t('totalPolicies')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{deliveryFees.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  {t('activePolicies')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {deliveryFees.filter(d => d.isActive).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {t('regionalPolicies')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {deliveryFees.filter(d => d.regions.length > 0).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 정책 목록 */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">{t('policyName')}</th>
                    <th className="p-3 text-left font-medium">{t('deliveryFee')}</th>
                    <th className="p-3 text-left font-medium">{t('freeShipping')}</th>
                    <th className="p-3 text-left font-medium">{t('appliedRegions')}</th>
                    <th className="p-3 text-left font-medium">{t('status')}</th>
                    <th className="p-3 text-left font-medium">{t('manage')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </td>
                    </tr>
                  ) : deliveryFees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        {t('noDeliveryPolicies')}
                      </td>
                    </tr>
                  ) : (
                    deliveryFees.map((delivery) => (
                      <tr key={delivery.id} className="border-b hover:bg-muted/30">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{delivery.name}</span>
                            {delivery.isDefault && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                {t('defaultLabel')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-medium">{formatPrice(delivery.fee)}</td>
                        <td className="p-3">
                          {delivery.freeAmount ? (
                            <span>{t('aboveAmount', { amount: formatPrice(delivery.freeAmount) })}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {delivery.regions.length > 0 ? (
                            <span className="text-sm">
                              {delivery.regions.slice(0, 2).join(', ')}
                              {delivery.regions.length > 2 && t('moreRegions', { count: delivery.regions.length - 2 })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{t('allDefaultRegion')}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            delivery.isActive
                              ? 'bg-green-500/10 text-green-600'
                              : 'bg-red-500/10 text-red-600'
                          }`}>
                            {delivery.isActive ? t('active') : t('inactive')}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setEditingDelivery(delivery); setModalOpen(true) }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(delivery.id)}
                              disabled={delivery.isDefault}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>

      <DeliveryModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingDelivery(null) }}
        delivery={editingDelivery}
        onSave={handleSave}
      />
    </div>
  )
}
