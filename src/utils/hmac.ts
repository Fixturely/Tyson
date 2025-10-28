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

/**
 * Verifies HMAC signature using constant-time comparison
 * @param signature - The signature from the header
 * @param payload - The payload to verify
 * @param secret - The shared secret key
 * @returns true if signature is valid, false otherwise
 */
export function verifyHMAC(
  signature: string,
  payload: string,
  secret: string
): boolean {
  const computedSignature = computeHMAC(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}
