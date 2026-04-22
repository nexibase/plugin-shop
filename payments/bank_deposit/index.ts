import type { PaymentAdapter, PrepareResult, CallbackResult, RefundParams, RefundResult, PayMethod } from '../adapter'

export class BankDepositAdapter implements PaymentAdapter {
  readonly id = 'bank_deposit'
  readonly displayName = '무통장입금'
  readonly supportedMethods: PayMethod[] = ['bank_deposit']

  async prepare(): Promise<PrepareResult> {
    return { kind: 'manual' }
  }

  async handleCallback(rawRequest: unknown): Promise<CallbackResult> {
    // Invoked when admin marks "입금확인". rawRequest carries { orderNo, confirmedAmount }.
    const req = rawRequest as { orderNo: string; confirmedAmount: number }
    return {
      success: true,
      pgTransactionId: `manual-${req.orderNo}`,
      paidAmount: req.confirmedAmount,
      method: 'bank_deposit',
      rawResponse: req,
    }
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    // Manual process — admin performs bank transfer outside the system, then marks complete.
    // System only records that refund was issued; no PG API exists.
    return { success: true, refundedAmount: params.amount, pgRefundId: `manual-refund-${Date.now()}` }
  }

  async parseCallbackRequest(req: Request): Promise<unknown> {
    return await req.json()
  }

  extractOrderNo(parsed: unknown): string {
    return (parsed as any).orderNo
  }
}
