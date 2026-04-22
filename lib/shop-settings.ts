import { prisma } from '@/lib/prisma'

export async function getShopSetting(key: string): Promise<string | null> {
  const row = await prisma.shopSetting.findUnique({ where: { key } })
  return row?.value ?? null
}

export async function setShopSetting(key: string, value: string): Promise<void> {
  await prisma.shopSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}
