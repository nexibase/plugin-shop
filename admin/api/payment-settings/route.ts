import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getShopSetting, setShopSetting } from '@/plugins/shop/lib/shop-settings'
import { bootstrapPaymentAdapters } from '@/plugins/shop/payments/bootstrap'
import { get as getAdapter } from '@/plugins/shop/payments/registry'

bootstrapPaymentAdapters()

const ALL_ADAPTERS = ['inicis', 'bank_deposit'] // extend when more adapters are added

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const enabled = JSON.parse((await getShopSetting('enabled_payment_gateways')) ?? '["inicis","bank_deposit"]')
  const defaultCard = (await getShopSetting('default_card_gateway')) ?? 'inicis'
  const available = ALL_ADAPTERS.map(id => {
    const a = getAdapter(id)
    return a ? { id, displayName: a.displayName, supportedMethods: a.supportedMethods } : null
  }).filter(Boolean)
  return NextResponse.json({ enabled, defaultCard, available })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { enabled, defaultCard } = await req.json()
  if (!Array.isArray(enabled) || typeof defaultCard !== 'string') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  // Validate: defaultCard must be an enabled adapter that supports 'card'
  const adapter = getAdapter(defaultCard)
  if (!adapter || !adapter.supportedMethods.includes('card') || !enabled.includes(defaultCard)) {
    return NextResponse.json({ error: 'default card gateway must be enabled and support card' }, { status: 400 })
  }
  await setShopSetting('enabled_payment_gateways', JSON.stringify(enabled))
  await setShopSetting('default_card_gateway', defaultCard)
  return NextResponse.json({ ok: true })
}
