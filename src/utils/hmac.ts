import * as crypto from 'crypto';

/**
 * Computes HMAC-SHA256 signature for webhook notifications
 * @param payload - The payload to sign
 * @param secret - The shared secret key
 * @returns HMAC-SHA256 signature
 */
export function computeHMAC(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}
