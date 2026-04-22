/**
 * Inicis signature / hash helpers.
 *
 * All functions preserve the EXACT byte layout used by the legacy
 * api/payment/inicis routes so that Inicis will accept the request.
 * DO NOT alter the field order or hash algorithm without verifying
 * with the PG.
 */
import crypto from 'node:crypto'

// Build SHA-256 hex digest — identical to the sha256() helper used in
// the legacy api/payment/inicis/route.ts and return/route.ts files.
export function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex')
}

/**
 * Payment-request signature.
 * Hash input: `oid=<oid>&price=<price>&timestamp=<timestamp>`
 * Matches the signature built in api/payment/inicis/route.ts line 196.
 */
export function buildSignature(params: {
  oid: string
  price: number
  timestamp: string
}): string {
  return sha256(`oid=${params.oid}&price=${params.price}&timestamp=${params.timestamp}`)
}

/**
 * mKey: SHA-256 of the merchant sign key.
 * Matches api/payment/inicis/route.ts line 198.
 */
export function buildMKey(signKey: string): string {
  return sha256(signKey)
}

/**
 * Auth-approval signature (sent to Inicis stdpay auth endpoint).
 * Hash input: `authToken=<authToken>&timestamp=<timestamp>`
 * Matches return/route.ts line 187.
 */
export function buildAuthSignature(params: {
  authToken: string
  timestamp: string
}): string {
  return sha256(`authToken=${params.authToken}&timestamp=${params.timestamp}`)
}

/**
 * Auth-approval verification (sent alongside signature to auth endpoint).
 * Hash input: `authToken=<authToken>&signKey=<signKey>&timestamp=<timestamp>`
 * Matches return/route.ts line 188.
 */
export function buildVerification(params: {
  authToken: string
  signKey: string
  timestamp: string
}): string {
  return sha256(
    `authToken=${params.authToken}&signKey=${params.signKey}&timestamp=${params.timestamp}`
  )
}

/**
 * IDC-specific payment-approval URL.
 * Matches return/route.ts getAuthUrl().
 */
export function getAuthUrl(idcName: string): string {
  const baseUrl = 'stdpay.inicis.com/api/payAuth'
  switch (idcName) {
    case 'fc':
      return `https://fc${baseUrl}`
    case 'ks':
      return `https://ks${baseUrl}`
    case 'stg':
      return `https://stg${baseUrl}`
    default:
      return `https://stg${baseUrl}`
  }
}

/**
 * IDC-specific net-cancel URL.
 * Matches return/route.ts getNetCancelUrl().
 */
export function getNetCancelUrl(idcName: string): string {
  const baseUrl = 'stdpay.inicis.com/api/netCancel'
  switch (idcName) {
    case 'fc':
      return `https://fc${baseUrl}`
    case 'ks':
      return `https://ks${baseUrl}`
    case 'stg':
      return `https://stg${baseUrl}`
    default:
      return `https://stg${baseUrl}`
  }
}
