export type OrderStatus =
  | 'pending' | 'paid' | 'preparing' | 'shipping' | 'delivered' | 'confirmed'
  | 'cancel_requested' | 'cancelled'

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:          ['paid', 'cancel_requested', 'cancelled'],
  paid:             ['preparing', 'cancel_requested', 'cancelled'],
  preparing:        ['shipping', 'cancelled'],
  shipping:         ['delivered'],
  delivered:        ['confirmed'],
  confirmed:        [],
  cancel_requested: ['cancelled', 'paid'],
  cancelled:        [],
}

export class TransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Transition not allowed: ${from} → ${to}`)
    this.name = 'TransitionError'
  }
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!ORDER_TRANSITIONS[from]?.includes(to)) {
    throw new TransitionError(from, to)
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false
}

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[from] ?? []
}
