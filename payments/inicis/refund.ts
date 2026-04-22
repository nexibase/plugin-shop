/**
 * Inicis refund (cancel) via v2 REST API.
 *
 * Ported from api/payment/inicis/cancel/route.ts cancelInicisPayment().
 * Hash algorithm: SHA-512 of (apiKey + mid + type + timestamp + JSON.stringify(data))
 * where data = { tid, msg }.
 *
 * Test-mode: skip the real PG call and return success immediately,
 * matching the behaviour of the legacy route.
 */
import crypto from 'node:crypto'
import type { RefundParams, RefundResult } from '../adapter'
import { getShopSetting } from '../../lib/shop-settings'

// Inicis v2 refund endpoint (production only — test mode skips the call).
const INICIS_REFUND_URL = 'https://iniapi.inicis.com/v2/pg/refund'

/** YYYYMMDDhhmmss timestamp — matches cancel/route.ts getTimestamp() */
function getTimestamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}${hours}${minutes}${seconds}`
}

export async function refundInicis(params: RefundParams): Promise<RefundResult> {
  // Load shop settings (same source as the legacy cancel route).
  const testMode = (await getShopSetting('pg_test_mode')) !== 'false'

  // Test mode skips the PG call entirely — matches legacy cancel route behavior, not the plan stub's v1 endpoint.
  // Test mode: skip real PG call, return success — mirrors legacy cancel route lines 91-103.
  if (testMode) {
    console.log('테스트 모드: 실제 PG 취소 API 호출 생략, tid:', params.pgTransactionId)
    return {
      success: true,
      refundedAmount: params.amount,
      pgRefundId: params.pgTransactionId,
    }
  }

  const mid = (await getShopSetting('pg_mid')) ?? 'INIpayTest'
  const iniApiKey = (await getShopSetting('pg_apikey')) ?? ''

  if (!iniApiKey) {
    return {
      success: false,
      refundedAmount: 0,
      errorMessage: 'PG API Key가 설정되지 않았습니다.',
    }
  }

  // 10-second timeout via AbortController — matches legacy cancel route.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const timestamp = getTimestamp()
    const type = 'refund'
    const clientIp = '127.0.0.1'

    // data payload — matches cancel/route.ts lines 173-176.
    const data = {
      tid: params.pgTransactionId,
      msg: params.reason,
    }

    // Hash input follows the live legacy route at src/plugins/shop/api/payment/inicis/cancel/route.ts,
    // not the Task 5.4 plan stub — the plan stub's formula was incorrect for the v2 refund API.
    // SHA-512 hash: apiKey + mid + type + timestamp + JSON.stringify(data)
    // Matches cancel/route.ts lines 179-181.
    const dataStr = JSON.stringify(data)
    const plainTxt = iniApiKey + mid + type + timestamp + dataStr
    const hashData = crypto.createHash('sha512').update(plainTxt).digest('hex')

    const requestBody = {
      mid,
      type,
      timestamp,
      clientIp,
      data,
      hashData,
    }

    console.log('inicis refund request:', { mid, type, timestamp })

    const response = await fetch(INICIS_REFUND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const result = await response.json() as {
      resultCode: string
      resultMsg?: string
      tid?: string
    }
    console.log('inicis refund response:', result)

    // resultCode '00' = success — matches cancel/route.ts line 214.
    if (result.resultCode === '00') {
      return {
        success: true,
        refundedAmount: params.amount,
        pgRefundId: result.tid ?? params.pgTransactionId,
      }
    }

    return {
      success: false,
      refundedAmount: 0,
      errorMessage: `${result.resultCode}: ${result.resultMsg ?? '결제 취소 실패'}`,
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      console.error('inicis refund API timeout')
      return {
        success: false,
        refundedAmount: 0,
        errorMessage: '결제 취소 API 응답 시간 초과',
      }
    }

    console.error('inicis refund API call failed:', error)
    return {
      success: false,
      refundedAmount: 0,
      errorMessage: '결제 취소 API 호출 실패',
    }
  }
}
