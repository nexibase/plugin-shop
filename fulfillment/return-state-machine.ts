import { TransitionError } from './state-machine'

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'collected' | 'completed'

export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ['approved', 'rejected'],
  approved:  ['collected'],
  collected: ['completed'],
  completed: [],
  rejected:  [],
}

export function assertReturnTransition(from: ReturnStatus, to: ReturnStatus): void {
  if (!RETURN_TRANSITIONS[from]?.includes(to)) {
    throw new TransitionError(from, to)
  }
}

export function allowedReturnTransitions(from: ReturnStatus): ReturnStatus[] {
  return RETURN_TRANSITIONS[from] ?? []
}
