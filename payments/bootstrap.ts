import { register } from './registry'
import { InicisAdapter } from './inicis'
import { BankDepositAdapter } from './bank_deposit'

let bootstrapped = false

export function bootstrapPaymentAdapters(): void {
  if (bootstrapped) return
  register(new InicisAdapter())
  register(new BankDepositAdapter())
  bootstrapped = true
}
