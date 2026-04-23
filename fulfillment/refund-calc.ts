export interface RefundCalcItem {
  unitPrice: number
  quantity: number
}

export interface RefundCalcInput {
  items: RefundCalcItem[]
  shippingFeeDeduction?: number  // amount to deduct from refund for return shipping (0 if merchant covers)
}

export interface RefundCalcResult {
  subtotal: number
  shippingFeeDeduction: number
  refundAmount: number
}

export function calculateRefund(input: RefundCalcInput): RefundCalcResult {
  const subtotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  const shippingFeeDeduction = input.shippingFeeDeduction ?? 0
  const refundAmount = Math.max(0, subtotal - shippingFeeDeduction)
  return { subtotal, shippingFeeDeduction, refundAmount }
}
