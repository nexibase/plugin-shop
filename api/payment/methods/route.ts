import { NextResponse } from 'next/server'
import { bootstrapPaymentAdapters } from '@/plugins/shop/payments/bootstrap'
import { listEnabled } from '@/plugins/shop/payments/registry'

bootstrapPaymentAdapters()

export async function GET() {
  const enabled = await listEnabled()
  return NextResponse.json({
    methods: enabled.flatMap(a => a.supportedMethods.map(m => ({
      method: m, adapterId: a.id, displayName: a.displayName,
    }))),
  })
}
