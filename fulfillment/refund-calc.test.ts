import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateRefund } from './refund-calc'

test('single item full refund', () => {
  const r = calculateRefund({ items: [{ unitPrice: 10000, quantity: 2 }] })
  assert.equal(r.subtotal, 20000)
  assert.equal(r.shippingFeeDeduction, 0)
  assert.equal(r.refundAmount, 20000)
})

test('shipping fee deducted from refund', () => {
  const r = calculateRefund({
    items: [{ unitPrice: 10000, quantity: 1 }],
    shippingFeeDeduction: 3000,
  })
  assert.equal(r.refundAmount, 7000)
})

test('refund clamped to zero when deduction exceeds subtotal', () => {
  const r = calculateRefund({
    items: [{ unitPrice: 1000, quantity: 1 }],
    shippingFeeDeduction: 5000,
  })
  assert.equal(r.refundAmount, 0)
})

test('multi-item sum', () => {
  const r = calculateRefund({
    items: [{ unitPrice: 5000, quantity: 2 }, { unitPrice: 3000, quantity: 1 }],
  })
  assert.equal(r.subtotal, 13000)
})
