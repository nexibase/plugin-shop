export type PayMethod =
  | 'card' | 'account_transfer' | 'virtual_account' | 'mobile' | 'bank_deposit'

export interface PrepareOpts {
  returnUrl: string
  closeUrl: string
  locale?: string
}

export interface PrepareResult {
  kind: 'redirect' | 'form' | 'manual'
  redirectUrl?: string
  formAction?: string
  formFields?: Record<string, string>
}

export interface CallbackResult {
  success: boolean
  pgTransactionId: string
  paidAmount: number
  method: PayMethod
  rawResponse: unknown
  errorMessage?: string
}

export interface RefundParams {
  pgTransactionId: string
  amount: number
  reason: string
  orderRef: string
}

export interface RefundResult {
  success: boolean
  refundedAmount: number
  pgRefundId?: string
  errorMessage?: string
}

export interface AdapterOrderSnapshot {
  id: number
  orderNo: string
  finalPrice: number
  ordererName: string
  ordererPhone: string
  ordererEmail?: string | null
  items: { productName: string; quantity: number }[]
}

export interface PaymentAdapter {
  readonly id: string
  readonly displayName: string
  readonly supportedMethods: PayMethod[]

  prepare(order: AdapterOrderSnapshot, opts: PrepareOpts): Promise<PrepareResult>
  handleCallback(rawRequest: unknown): Promise<CallbackResult>
  refund(params: RefundParams): Promise<RefundResult>
}
