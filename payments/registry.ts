import type { PaymentAdapter, PayMethod } from './adapter'
import { getShopSetting } from '../lib/shop-settings'

const adapters = new Map<string, PaymentAdapter>()

export function register(adapter: PaymentAdapter): void {
  adapters.set(adapter.id, adapter)
}

export function get(id: string): PaymentAdapter | null {
  return adapters.get(id) ?? null
}

export async function listEnabled(): Promise<PaymentAdapter[]> {
  const enabledJson = (await getShopSetting('enabled_payment_gateways')) ?? '["inicis","bank_deposit"]'
  const ids: string[] = JSON.parse(enabledJson)
  return ids.map(id => adapters.get(id)).filter((a): a is PaymentAdapter => !!a)
}

/**
 * Resolve (customer-facing method) → (PaymentAdapter) based on shop settings.
 * - bank_deposit → built-in 'bank_deposit' adapter
 * - card/account_transfer/virtual_account/mobile → shop_settings.default_card_gateway
 */
export async function resolveMethodToAdapter(method: PayMethod): Promise<PaymentAdapter | null> {
  if (method === 'bank_deposit') return adapters.get('bank_deposit') ?? null
  const defaultId = (await getShopSetting('default_card_gateway')) ?? 'inicis'
  return adapters.get(defaultId) ?? null
}

// test-only
export function _clearForTests(): void { adapters.clear() }
