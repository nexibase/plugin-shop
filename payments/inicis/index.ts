/**
 * InicisAdapter — wraps Inicis 웹표준결제 (INIStdPay) as a PaymentAdapter.
 *
 * prepare()        → builds the form fields that the client POSTs directly to
 *                    Inicis (same PaymentData object the legacy route returned).
 * handleCallback() → verifies and approves the Inicis auth callback, then
 *                    returns a CallbackResult for the fulfillment layer.
 * refund()         → delegates to refundInicis() in ./refund.ts.
 *
 * All signature math is delegated to ./signature.ts and is byte-compatible
 * with the legacy api/payment/inicis/* routes.
 */
import type {
  PaymentAdapter,
  AdapterOrderSnapshot,
  PrepareOpts,
  PrepareResult,
  CallbackResult,
  RefundParams,
  RefundResult,
  PayMethod,
} from '../adapter'
import {
  buildSignature,
  buildMKey,
  buildAuthSignature,
  buildVerification,
  getAuthUrl,
  getNetCancelUrl,
} from './signature'
import { refundInicis } from './refund'
import { getShopSetting } from '../../lib/shop-settings'

// Test-mode sign key — must match the value used in the legacy routes:
//   api/payment/inicis/route.ts line 81
//   api/payment/inicis/return/route.ts line 177
// Decodes to: INILITE_TRIPLEDES_KEYSTR
const INICIS_TEST_SIGN_KEY = 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS'

export class InicisAdapter implements PaymentAdapter {
  readonly id = 'inicis'
  readonly displayName = '신용카드 (이니시스)'
  readonly supportedMethods: PayMethod[] = ['card', 'account_transfer', 'virtual_account', 'mobile']

  // ───────────────────────────────────────────────────────────────────────────
  // prepare()
  //
  // Builds the Inicis form-field payload that the browser submits to INIStdPay.
  // Field names, values, and hash construction are ported verbatim from
  // api/payment/inicis/route.ts (POST handler, lines 181-236).
  // ───────────────────────────────────────────────────────────────────────────
  async prepare(order: AdapterOrderSnapshot, opts: PrepareOpts): Promise<PrepareResult> {
    // Load PG settings from shop_settings table (same source as legacy route).
    const testMode = (await getShopSetting('pg_test_mode')) !== 'false'
    const mid = testMode
      ? 'INIpayTest'
      : ((await getShopSetting('pg_mid')) ?? 'INIpayTest')
    const signKey = testMode
      ? INICIS_TEST_SIGN_KEY
      : ((await getShopSetting('pg_signkey')) ?? INICIS_TEST_SIGN_KEY)

    // Goods name: "대표상품명 외 N건" when multiple items — matches legacy route lines 182-184.
    const goodsName =
      order.items.length > 1
        ? `${order.items[0].productName} 외 ${order.items.length - 1}건`
        : order.items[0]?.productName ?? '상품'

    // Payment script URL — matches legacy route lines 187-189.
    const payUrl = testMode
      ? 'https://stgstdpay.inicis.com/stdjs/INIStdPay.js'
      : 'https://stdpay.inicis.com/stdjs/INIStdPay.js'

    // Timestamp (milliseconds string) — matches legacy route line 181.
    const timestamp = Date.now().toString()

    // Signature and mKey — exact math from legacy route lines 196-198.
    const signature = buildSignature({
      oid: order.orderNo,
      price: order.finalPrice,
      timestamp,
    })
    const mKey = buildMKey(signKey)

    // returnUrl / closeUrl come from PrepareOpts; popupUrl replaces the suffix.
    // The legacy route derived all three from the same baseUrl pattern:
    //   ${baseUrl}/api/shop/payment/inicis/{return,close,popup}
    // We receive returnUrl and closeUrl from opts; derive popupUrl from returnUrl.
    const popupUrl = opts.returnUrl.replace(/\/return$/, '/popup')

    const formFields: Record<string, string> = {
      // Basic info — matches legacy PaymentData object.
      version: '1.0',
      mid,
      oid: order.orderNo,
      goodname: goodsName,
      price: String(order.finalPrice),
      currency: 'WON',

      // Buyer info.
      buyername: order.ordererName,
      buyertel: order.ordererPhone,
      buyeremail: order.ordererEmail ?? '',

      // Timestamp and signatures.
      timestamp,
      signature,
      mKey,

      // Callback URLs.
      returnUrl: opts.returnUrl,
      closeUrl: opts.closeUrl,
      popupUrl,

      // Payment method — legacy route hardcodes 'Card'.
      gopaymethod: 'Card',

      // Accept method — matches legacy route line 231.
      acceptmethod: 'below1000:centerCd(Y)',

      // Payment script URL (consumed by the client-side JS).
      payUrl,
      testMode: String(testMode),
    }

    // Inicis uses window.INIStdPay.pay(formId) rather than a plain form POST.
    // formAction is set to '' (empty) so any fallback submit doesn't navigate to the SDK URL.
    // The client must load INIStdPay.js (already loaded via <Script> in checkout page) and
    // call INIStdPay.pay() instead of submitting the form. The payUrl is available in
    // formFields['payUrl'] for clients that need to load the SDK dynamically.
    return {
      kind: 'form',
      formAction: '',
      formFields,
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // handleCallback()
  //
  // Processes the Inicis auth callback (POST to /api/shop/payment/inicis/return).
  // Ported from api/payment/inicis/return/route.ts POST handler.
  //
  // rawRequest must be an object with the form-urlencoded fields that Inicis
  // posts to the returnUrl endpoint.
  // ───────────────────────────────────────────────────────────────────────────
  async handleCallback(rawRequest: unknown): Promise<CallbackResult> {
    const body = rawRequest as Record<string, string>

    const resultCode = body.resultCode
    const resultMsg = body.resultMsg

    // Authentication failure — matches return/route.ts lines 159-173.
    if (resultCode !== '0000') {
      return {
        success: false,
        pgTransactionId: '',
        paidAmount: 0,
        method: 'card',
        rawResponse: body,
        errorMessage: resultMsg ?? '결제 인증에 실패했습니다.',
      }
    }

    // Load signKey for verification hash — matches return/route.ts line 177.
    const testMode = (await getShopSetting('pg_test_mode')) !== 'false'
    const signKey = testMode
      ? INICIS_TEST_SIGN_KEY
      : ((await getShopSetting('pg_signkey')) ?? INICIS_TEST_SIGN_KEY)

    const mid = body.mid
    const authToken = body.authToken
    const idcName = body.idc_name ?? 'stg'
    const timestamp = Date.now().toString()

    // Auth signature and verification — exact math from return/route.ts lines 187-188.
    const signature = buildAuthSignature({ authToken, timestamp })
    const verification = buildVerification({ authToken, signKey, timestamp })

    // Build approval request params — matches return/route.ts lines 191-199.
    const authData = new URLSearchParams({
      mid,
      authToken,
      timestamp,
      signature,
      verification,
      charset: 'UTF-8',
      format: 'JSON',
    })

    // Use the IDC-specific URL — matches return/route.ts line 202+.
    const expectedAuthUrl = getAuthUrl(idcName)
    const authUrl = body.authUrl
    if (authUrl !== expectedAuthUrl) {
      console.warn('이니시스 인증 URL 불일치:', authUrl, expectedAuthUrl)
    }

    // Call Inicis approval endpoint — matches return/route.ts lines 208-216.
    const authResponse = await fetch(expectedAuthUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: authData.toString(),
    })

    const authResult = await authResponse.json() as {
      resultCode: string
      resultMsg?: string
      MOID?: string
      tid?: string
      TotPrice?: string
      payMethod?: string
      CARD_BankCode?: string
      CARD_Num?: string
      CARD_Quota?: string
      applNum?: string
      applDate?: string
      applTime?: string
    }

    console.log('이니시스 승인 결과:', authResult)

    // Approval failure — matches return/route.ts lines 349-361.
    if (authResult.resultCode !== '0000') {
      return {
        success: false,
        pgTransactionId: '',
        paidAmount: 0,
        method: 'card',
        rawResponse: authResult,
        errorMessage: authResult.resultMsg ?? '결제 승인에 실패했습니다.',
      }
    }

    const orderNo = authResult.MOID ?? ''
    const tid = authResult.tid ?? ''
    const totPrice = parseInt(authResult.TotPrice ?? '0', 10)

    // Resolve the payment method label.
    const method = resolvePayMethod(authResult.payMethod)

    return {
      success: true,
      pgTransactionId: tid,
      paidAmount: totPrice,
      method,
      rawResponse: authResult,
      // Also expose orderNo so callers can look up the PendingOrder.
      // (Stored in errorMessage field only when success=true would be odd;
      //  we attach it via rawResponse which is typed as `unknown`.)
    }
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    return refundInicis(params)
  }

  async parseCallbackRequest(req: Request): Promise<unknown> {
    const form = await req.formData()
    return Object.fromEntries(form.entries())
  }

  extractOrderNo(parsed: unknown): string {
    const p = (parsed ?? {}) as Record<string, string>
    return p.MOID ?? p.oid ?? ''
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map Inicis payMethod string to our PayMethod enum.
 * The legacy route hardcodes 'card'; we keep that as the default.
 */
function resolvePayMethod(inicisPayMethod?: string): PayMethod {
  switch (inicisPayMethod) {
    case 'Card':
    case 'CARD':
      return 'card'
    case 'DirectBank':
    case 'Bank':
      return 'account_transfer'
    case 'VBank':
      return 'virtual_account'
    case 'HPP':
    case 'Mobile':
      return 'mobile'
    default:
      return 'card'
  }
}

/**
 * Re-export getNetCancelUrl so the legacy return/route.ts can call it if needed
 * during the transition period (Tasks 4-6).
 */
export { getNetCancelUrl }
