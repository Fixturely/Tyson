import 'dotenv/config';
import Stripe from 'stripe';
import config from '../../../config';

const secretKey =
  config.stripe?.secretKey || process.env.STRIPE_SECRET_KEY || '';
if (!secretKey) {
  throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(secretKey, {
  apiVersion: config.stripe.apiVersion as Stripe.LatestApiVersion,
});

// Explicit return types for payment intent functions
export interface CreatePaymentIntentResult {
  id: string;
  amount: number;
  currency: string;
  client_secret: string | null;
  status: string;
  customer?: string | null;
  description?: string | null;
  metadata?: any;
  created: number;
  payment_method?: string | null;
}

export interface ConfirmPaymentIntentResult {
  id: string;
  amount: number;
  currency: string;
  client_secret: string | null;
  status: string;
  customer?: string | null;
  description?: string | null;
  metadata?: any;
  created: number;
  payment_method?: string | null;
}

export async function createPaymentIntent(
  amountCents: number,
  currency = 'usd'
): Promise<CreatePaymentIntentResult> {
  const pi = await stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never',
    },
  });
  return {
    id: pi.id,
    amount: pi.amount,
    currency: pi.currency,
    client_secret: pi.client_secret,
    status: pi.status,
    customer: pi.customer
      ? typeof pi.customer === 'string'
        ? pi.customer
        : pi.customer.id
      : null,
    description: pi.description,
    metadata: pi.metadata,
    created: pi.created,
    payment_method: pi.payment_method
      ? typeof pi.payment_method === 'string'
        ? pi.payment_method
        : pi.payment_method.id
      : null,
  };
}

export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethod: string = 'pm_card_visa'
): Promise<ConfirmPaymentIntentResult> {
  const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethod,
  });
  return {
    id: confirmed.id,
    amount: confirmed.amount,
    currency: confirmed.currency,
    client_secret: confirmed.client_secret,
    status: confirmed.status,
    customer: confirmed.customer
      ? typeof confirmed.customer === 'string'
        ? confirmed.customer
        : confirmed.customer.id
      : null,
    description: confirmed.description,
    metadata: confirmed.metadata,
    created: confirmed.created,
    payment_method: confirmed.payment_method
      ? typeof confirmed.payment_method === 'string'
        ? confirmed.payment_method
        : confirmed.payment_method.id
      : null,
  };
}
