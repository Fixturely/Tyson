import Stripe from 'stripe';
import logger from '../../utils/logger';
import { mapPaymentIntentToResult } from './helper';

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

export interface StripeServiceDependencies {
  stripe: Stripe;
}

export class StripeService {
  constructor(private deps: StripeServiceDependencies) {}

  async createPaymentIntent(
    amountCents: number,
    currency = 'usd',
    options?: {
      customer?: string;
      description?: string;
      metadata?: any;
    }
  ): Promise<CreatePaymentIntentResult> {
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
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

    const pi =
      await this.deps.stripe.paymentIntents.create(paymentIntentParams);
    return mapPaymentIntentToResult(pi);
  }

  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethod: string = 'pm_card_visa'
  ): Promise<ConfirmPaymentIntentResult> {
    const confirmed = await this.deps.stripe.paymentIntents.confirm(
      paymentIntentId,
      {
        payment_method: paymentMethod,
      }
    );
    return mapPaymentIntentToResult(confirmed);
  }

  async createOrGetStripeCustomer(customerInfo: {
    email: string;
    name?: string;
  }): Promise<Stripe.Customer> {
    try {
      // Check if customer exists by email
      const existingCustomers = await this.deps.stripe.customers.list({
        email: customerInfo.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        logger.info(
          `Found existing Stripe customer: ${existingCustomers.data[0]?.id}`
        );
        return existingCustomers.data[0] as Stripe.Customer;
      }
      const newCustomer = await this.deps.stripe.customers.create({
        email: customerInfo.email,
        name: customerInfo.name || '',
      });

      logger.info(`Created new Stripe customer: ${newCustomer.id}`);
      return newCustomer;
    } catch (error) {
      logger.error(`Error creating/getting Stripe customer: ${error}`);
      throw error;
    }
  }
}
