import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
async function main() {
  const { registerShopNotificationEvents } = await import('../lib/notifications')
  const { prisma } = await import('@/lib/prisma')
  try {
    await registerShopNotificationEvents()
    console.log('Shop notification rules initialized from legacy email setting. Existing rules preserved.')
  } finally { await prisma.$disconnect() }
}
main().catch(() => { console.error('Shop notification migration failed'); process.exitCode = 1 })
