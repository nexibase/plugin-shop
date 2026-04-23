import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertReturnTransition, allowedReturnTransitions } from './return-state-machine'
import { TransitionError } from './state-machine'

test('requested → approved allowed', () => {
  assert.doesNotThrow(() => assertReturnTransition('requested', 'approved'))
})

test('requested → rejected allowed', () => {
  assert.doesNotThrow(() => assertReturnTransition('requested', 'rejected'))
})

test('approved → completed rejected (must go via collected)', () => {
  assert.throws(() => assertReturnTransition('approved', 'completed'), TransitionError)
})

test('completed is terminal', () => {
  assert.deepEqual(allowedReturnTransitions('completed'), [])
})

test('rejected is terminal', () => {
  assert.deepEqual(allowedReturnTransitions('rejected'), [])
})
