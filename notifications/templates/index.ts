import type { NotificationPayload } from '../send'
import returnRequested from './return-requested'
import returnApproved from './return-approved'
import returnRejected from './return-rejected'
import returnCollected from './return-collected'
import returnRefunded from './return-refunded'
import exchangeSent from './exchange-sent'

export interface RenderedTemplate {
  title: string
  body: string
  subject: string
  html: string
}

const TEMPLATES: Record<string, (payload: NotificationPayload) => RenderedTemplate> = {
  return_requested: returnRequested,
  return_approved: returnApproved,
  return_rejected: returnRejected,
  return_collected: returnCollected,
  return_refunded: returnRefunded,
  exchange_sent: exchangeSent,
}

export function renderInAppTemplate(payload: NotificationPayload): { title: string; body: string } {
  const t = TEMPLATES[payload.event]
  if (!t) return { title: payload.event, body: '' }
  const r = t(payload)
  return { title: r.title, body: r.body }
}

export function renderEmailTemplate(payload: NotificationPayload): { subject: string; html: string } {
  const t = TEMPLATES[payload.event]
  if (!t) return { subject: payload.event, html: '' }
  const r = t(payload)
  return { subject: r.subject, html: r.html }
}
