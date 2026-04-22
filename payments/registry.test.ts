import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { register, get, _clearForTests } from './registry'
import type { PaymentAdapter } from './adapter'

beforeEach(() => _clearForTests())

test('register and get by id', () => {
  const stub: PaymentAdapter = {
    id: 'stub', displayName: 'Stub', supportedMethods: ['card'],
    prepare: async () => ({ kind: 'redirect', redirectUrl: '/x' }),
    handleCallback: async () => ({ success: true, pgTransactionId: 'x', paidAmount: 0, method: 'card', rawResponse: null }),
    refund: async () => ({ success: true, refundedAmount: 0 }),
  }
  register(stub)
  assert.equal(get('stub'), stub)
  assert.equal(get('missing'), null)
})
