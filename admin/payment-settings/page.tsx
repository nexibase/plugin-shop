"use client"
import { useEffect, useState } from "react"
import { Sidebar } from "@/components/admin/Sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

interface Adapter {
  id: string
  displayName: string
  supportedMethods: string[]
}

export default function PaymentSettingsPage() {
  const [available, setAvailable] = useState<Adapter[]>([])
  const [enabled, setEnabled] = useState<string[]>([])
  const [defaultCard, setDefaultCard] = useState('inicis')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const r = await fetch('/api/admin/shop/payment-settings')
    const d = await r.json()
    setAvailable(d.available ?? [])
    setEnabled(d.enabled ?? [])
    setDefaultCard(d.defaultCard ?? 'inicis')
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    const r = await fetch('/api/admin/shop/payment-settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, defaultCard }),
    })
    setSaving(false)
    if (r.ok) alert('저장되었습니다')
    else alert((await r.json()).error ?? '저장 실패')
  }

  const toggle = (id: string) => setEnabled(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const cardCapable = available.filter(a => a.supportedMethods.includes('card') && enabled.includes(a.id))

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="space-y-4 max-w-2xl">
          <h1 className="text-xl font-semibold">결제 설정</h1>

          <Card>
            <CardHeader><CardTitle className="text-base">활성 결제수단</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {available.map(a => (
                <label key={a.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={enabled.includes(a.id)} onCheckedChange={() => toggle(a.id)} />
                  <span className="font-medium">{a.displayName}</span>
                  <span className="text-xs text-muted-foreground">({a.supportedMethods.join(', ')})</span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">기본 카드 PG</CardTitle></CardHeader>
            <CardContent>
              {cardCapable.length === 0 ? (
                <p className="text-sm text-muted-foreground">카드 결제를 지원하는 활성화된 PG가 없습니다.</p>
              ) : (
                <RadioGroup value={defaultCard} onValueChange={setDefaultCard}>
                  {cardCapable.map(a => (
                    <div key={a.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={a.id} id={`dcg-${a.id}`} />
                      <Label htmlFor={`dcg-${a.id}`}>{a.displayName}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </CardContent>
          </Card>

          <Button onClick={save} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
        </div>
      </main>
    </div>
  )
}
