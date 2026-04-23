import * as inApp from './channels/in-app'
import * as email from './channels/email'
import * as sms from './channels/sms'

export type NotificationEvent =
  | 'order_paid' | 'order_shipped' | 'order_delivered' | 'order_cancelled'
  | 'return_requested' | 'return_approved' | 'return_rejected'
  | 'return_collected' | 'return_refunded' | 'exchange_sent'

export type NotificationChannel = 'in_app' | 'email' | 'sms'

export interface NotificationPayload {
  event: NotificationEvent
  userId?: number
  adminBroadcast?: boolean
  data: Record<string, unknown>
}

const EVENT_CHANNELS: Record<NotificationEvent, NotificationChannel[]> = {
  order_paid:        ['in_app', 'email', 'sms'],
  order_shipped:     ['in_app', 'email', 'sms'],
  order_delivered:   ['in_app', 'email'],
  order_cancelled:   ['in_app', 'email', 'sms'],
  return_requested:  ['in_app'],
  return_approved:   ['in_app', 'email', 'sms'],
  return_rejected:   ['in_app', 'email'],
  return_collected:  ['in_app'],
  return_refunded:   ['in_app', 'email', 'sms'],
  exchange_sent:     ['in_app', 'email', 'sms'],
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const channels = EVENT_CHANNELS[payload.event] ?? []
  await Promise.allSettled(channels.map(async ch => {
    try {
      if (ch === 'in_app') return await inApp.send(payload)
      if (ch === 'email') return await email.send(payload)
      if (ch === 'sms') return await sms.send(payload)
    } catch (err) {
      console.error(`notification ${payload.event} via ${ch} failed:`, err)
    }
  }))
}
