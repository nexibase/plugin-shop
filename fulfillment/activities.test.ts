import { test } from 'node:test'
import assert from 'node:assert/strict'
import { logActivity } from './activities'

test('logActivity writes to orderActivity with null defaults', async () => {
  const captured: any[] = []
  const fakeDb = {
    orderActivity: {
      create: async (args: any) => { captured.push(args.data); return args.data },
    },
  } as any
  await logActivity(fakeDb, {
    orderId: 42,
    actorType: 'admin',
    actorId: 7,
    action: 'status_changed',
    fromStatus: 'paid',
    toStatus: 'preparing',
  })
  assert.equal(captured.length, 1)
  assert.equal(captured[0].orderId, 42)
  assert.equal(captured[0].actorType, 'admin')
  assert.equal(captured[0].actorId, 7)
  assert.equal(captured[0].fromStatus, 'paid')
  assert.equal(captured[0].toStatus, 'preparing')
  assert.equal(captured[0].memo, null)
})

test('logActivity omits undefined payload', async () => {
  const captured: any[] = []
  const fakeDb = {
    orderActivity: { create: async (args: any) => { captured.push(args.data) } },
  } as any
  await logActivity(fakeDb, { orderId: 1, actorType: 'system', action: 'order_created' })
  assert.equal(captured[0].payload, undefined)
  assert.equal(captured[0].actorId, null)
})
