import { prisma } from '@/lib/prisma'
import { getShopSetting } from '../../lib/shop-settings'
import type { NotificationPayload } from '../send'
import { renderInAppTemplate } from '../templates'

export async function send(payload: NotificationPayload): Promise<void> {
  const globalOn = (await getShopSetting('sms_notifications_enabled')) === 'true'
  if (!globalOn) return
  if (!payload.userId) return

  // Fetch user with phone and optional smsOptIn.
  // smsOptIn does not exist on the User model yet; we cast to allow the optional field
  // and treat its absence as "opted in" (graceful degradation).
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { phone: true },
  }) as { phone: string | null; smsOptIn?: boolean } | null

  if (!user?.phone) return
  if (user.smsOptIn === false) return  // explicit opt-out (if field exists)

  const configStr = (await getShopSetting('sms_provider_config')) ?? '{}'
  let config: { apiKey?: string; apiSecret?: string; from?: string } = {}
  try { config = JSON.parse(configStr) } catch { /* ignore */ }
  if (!config.apiKey || !config.apiSecret || !config.from) {
    console.warn('SMS provider config incomplete — skipping send')
    return
  }

  const { title, body } = renderInAppTemplate(payload)
  const msg = `${title}\n${body}`

  // CoolSMS v4 REST API — HMAC-SHA256 auth.
  // For production, install coolsms-node-sdk and use it directly.
  try {
    const crypto = await import('node:crypto')
    const salt = Math.random().toString(36).slice(2)
    const date = new Date().toISOString()
    const sig = crypto.createHmac('sha256', config.apiSecret)
      .update(date + salt)
      .digest('hex')
    const auth = `HMAC-SHA256 ApiKey=${config.apiKey}, Date=${date}, salt=${salt}, signature=${sig}`

    await fetch('https://api.coolsms.co.kr/messages/v4/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ message: { to: user.phone, from: config.from, text: msg } }),
    })
  } catch (err) {
    console.error('SMS send error:', err)
  }
}
