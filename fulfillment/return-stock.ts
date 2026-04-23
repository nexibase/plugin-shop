import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Restore stock for a return request's items. Called from admin "collect" action,
 * inside a $transaction.
 *
 * For each return_item:
 *   - If the order_item has an optionId: increment ProductOption.stock by quantity
 *   - Else: increment Product.stock by quantity
 *   - Always decrement Product.soldCount by quantity (reverses the decrement from payment success)
 */
export async function restoreStockForReturn(
  tx: PrismaClient | Prisma.TransactionClient,
  returnRequestId: number,
): Promise<void> {
  const items = await tx.returnItem.findMany({
    where: { returnRequestId },
    include: { orderItem: true },
  })
  for (const item of items) {
    const oi = item.orderItem
    if (oi.optionId) {
      await tx.productOption.update({
        where: { id: oi.optionId },
        data: { stock: { increment: item.quantity } },
      })
    } else if (oi.productId) {
      await tx.product.update({
        where: { id: oi.productId },
        data: { stock: { increment: item.quantity } },
      })
    }
    if (oi.productId) {
      await tx.product.update({
        where: { id: oi.productId },
        data: { soldCount: { decrement: item.quantity } },
      })
    }
  }
}
