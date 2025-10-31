import Stripe from 'stripe';
import config from '../../../config';
import { StripeService, StripeServiceDependencies } from './controller';

const secretKey =
  config.stripe?.secretKey || process.env.STRIPE_SECRET_KEY || '';
if (!secretKey) {
  throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripeInstance = new Stripe(secretKey, {
  apiVersion: config.stripe.apiVersion as Stripe.LatestApiVersion,
});

const defaultDependencies: StripeServiceDependencies = {
  stripe: stripeInstance,
};

export const stripeService = new StripeService(defaultDependencies);

// Export convenience functions that use the default instance
export async function createPaymentIntent(
  amountCents: number,
  currency = 'usd',
  options?: {
    customer?: string;
    description?: string;
    metadata?: any;
  }
) {
  return stripeService.createPaymentIntent(amountCents, currency, options);
}

export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethod: string = 'pm_card_visa'
) {
  return stripeService.confirmPaymentIntent(paymentIntentId, paymentMethod);
}

export async function createOrGetStripeCustomer(customerInfo: {
  email: string;
  name?: string;
}) {
  return stripeService.createOrGetStripeCustomer(customerInfo);
}

// Export types and class for testing/dependency injection
export {
  StripeService,
  StripeServiceDependencies,
  CreatePaymentIntentResult,
  ConfirmPaymentIntentResult,
} from './controller';
