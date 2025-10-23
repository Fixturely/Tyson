import 'dotenv/config';
import Stripe from 'stripe';
import config from '../../../config';
import logger from '../../utils/logger';

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
  currency = 'usd',
  options?: {
    customer?: string;
    description?: string;
    metadata?: any;
  }
): Promise<CreatePaymentIntentResult> {
  const paymentIntentParams: any = {
    amount: amountCents,
    currency,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never',
    },
  };

  // Only add optional properties if they exist
  if (options?.customer) {
    paymentIntentParams.customer = options.customer;
  }
  if (options?.description) {
    paymentIntentParams.description = options.description;
  }
  if (options?.metadata) {
    paymentIntentParams.metadata = options.metadata;
  }

  const pi = await stripe.paymentIntents.create(paymentIntentParams);
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

export async function createOrGetStripeCustomer(customerInfo: {
  email: string;
  name?: string;
}): Promise<Stripe.Customer> {
  try {
    // Check if customer exists by email
    const existingCustomers = await stripe.customers.list({
      email: customerInfo.email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      logger.info(
        `Found existing Stripe customer: ${existingCustomers.data[0]?.id}`
      );
      return existingCustomers.data[0] as Stripe.Customer;
    }
    const customerParams: any = {
      email: customerInfo.email,
    };

    if (customerInfo.email) {
      customerParams.name = customerInfo.name;
    }

    const newCustomer = await stripe.customers.create(customerParams);

    logger.info(`Created new Stripe customer: ${newCustomer.id}`);
    return newCustomer;
  } catch (error) {
    logger.error(`Error creating/getting Stripe customer: ${error}`);
    throw error;
  }
}
