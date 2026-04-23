import type { NotificationPayload } from '../send'
import { renderInAppTemplate } from '../templates'
import { createNotification } from '@/lib/notification'
import { prisma } from '@/lib/prisma'

// Shop notification events map to the 'order_status' preference bucket
// so users can control them via their notification preferences.
const NOTIFICATION_TYPE = 'order_status' as const

export async function send(payload: NotificationPayload): Promise<void> {
  const { title, body } = renderInAppTemplate(payload)

  if (payload.adminBroadcast) {
    // Broadcast to all admins (and managers when applicable)
    const admins = await prisma.user.findMany({
      where: { role: { in: ['admin', 'manager'] } },
      select: { id: true },
    })
    await Promise.all(admins.map(a =>
      createNotification({
        userId: a.id,
        type: NOTIFICATION_TYPE,
        title,
        message: body,
      })
    ))
    return
  }

  if (payload.userId) {
    await createNotification({
      userId: payload.userId,
      type: NOTIFICATION_TYPE,
      title,
      message: body,
    })
  }
}
