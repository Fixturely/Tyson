import Stripe from 'stripe';
import type {
  CreatePaymentIntentResult,
  ConfirmPaymentIntentResult,
} from './controller';
import { extractCustomerId, extractPaymentMethodId } from '../payments/helper';

/**
 * Map Stripe PaymentIntent to our result format
 * Uses shared extraction helpers from payments service for consistency
 */
export function mapPaymentIntentToResult(
  pi: Stripe.PaymentIntent
): CreatePaymentIntentResult {
  return {
    id: pi.id,
    amount: pi.amount,
    currency: pi.currency,
    client_secret: pi.client_secret,
    status: pi.status,
    customer: extractCustomerId(pi) ?? null,
    description: pi.description ?? null,
    metadata: pi.metadata ?? null,
    created: pi.created,
    payment_method: extractPaymentMethodId(pi) ?? null,
  };
}
