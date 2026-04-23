import type { NotificationPayload } from '../send'
import { renderEmailTemplate } from '../templates'
import { prisma } from '@/lib/prisma'
import { isEmailNotificationEnabled } from '@/lib/email'
import nodemailer from 'nodemailer'

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function send(payload: NotificationPayload): Promise<void> {
  if (!payload.userId) return
  if (!await isEmailNotificationEnabled()) return

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { email: true },
  })
  if (!user?.email) return

  const { subject, html } = renderEmailTemplate(payload)
  if (!subject && !html) return

  try {
    const transporter = createTransporter()
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject,
      html,
    })
  } catch (err) {
    console.error(`shop notification email send failed (event=${payload.event}):`, err)
  }
}
