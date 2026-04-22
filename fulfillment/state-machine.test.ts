import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertOrderTransition, canTransition, allowedTransitions, TransitionError } from './state-machine'

test('paid → preparing allowed', () => {
  assert.doesNotThrow(() => assertOrderTransition('paid', 'preparing'))
})

test('shipping → pending rejected', () => {
  assert.throws(() => assertOrderTransition('shipping', 'pending'), TransitionError)
})

test('confirmed is terminal', () => {
  assert.deepEqual(allowedTransitions('confirmed'), [])
})

test('canTransition non-throwing API', () => {
  assert.equal(canTransition('pending', 'paid'), true)
  assert.equal(canTransition('delivered', 'paid'), false)
})

test('cancel_requested can revert to paid', () => {
  assert.doesNotThrow(() => assertOrderTransition('cancel_requested', 'paid'))
})
