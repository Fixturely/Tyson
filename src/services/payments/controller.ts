import Stripe from 'stripe';
import logger from '../../utils/logger';
import { paymentIntentModel } from '../../models/payment_intent';
import { customerPaymentMethodsModel } from '../../models/customer_payment_methods';
import { zeusSubscriptionModel } from '../../models/zeus_subscriptions';
import { zeusNotificationService } from '../notifications';
import { mapStripePIToModel, handleZeusSubscription } from './helper';

// Dependencies interface for dependency injection (for testing)
export interface PaymentsServiceDependencies {
  stripe: Stripe;
  paymentIntentModel: typeof paymentIntentModel;
  customerPaymentMethodsModel: typeof customerPaymentMethodsModel;
  zeusSubscriptionModel: typeof zeusSubscriptionModel;
  zeusNotificationService: typeof zeusNotificationService;
}

// Payments domain service - handles business logic for payment events
export class PaymentsService {
  constructor(private deps: PaymentsServiceDependencies) {}

  /**
   * Handle payment intent creation event
   * Persists the payment intent to the database
   */
  async handlePaymentIntentCreated(pi: Stripe.PaymentIntent): Promise<void> {
    logger.info('Payment intent created', {
      id: pi.id,
      amount: pi.amount,
      currency: pi.currency,
      status: pi.status,
    });
    await this.deps.paymentIntentModel.upsertPaymentIntent(
      mapStripePIToModel(pi)
    );
  }

  /**
   * Handle payment intent succeeded event
   * Persists payment intent, optionally saves payment method, and handles Zeus subscriptions
   */
  async handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
    logger.info('Payment intent succeeded', {
      id: pi.id,
      amount: pi.amount,
      currency: pi.currency,
    });

    // Update payment intent status
    await this.deps.paymentIntentModel.upsertPaymentIntent(
      mapStripePIToModel(pi)
    );

    // If requested at creation time, persist the successful payment method
    try {
      const shouldSave =
        String((pi.metadata as any)?.save_payment_method).toLowerCase() ===
        'true';
      const pmId =
        typeof pi.payment_method === 'string'
          ? pi.payment_method
          : pi.payment_method?.id;
      const customerId =
        typeof pi.customer === 'string'
          ? pi.customer
          : (pi.customer as any)?.id;

      if (shouldSave && pmId && customerId) {
        const pm = await this.deps.stripe.paymentMethods.retrieve(pmId);
        await this.deps.customerPaymentMethodsModel.upsertFromStripePaymentMethod(
          pm,
          customerId
        );
      }
    } catch (pmSaveError) {
      logger.error('Failed to persist payment method after success', {
        error: pmSaveError,
        payment_intent_id: pi.id,
      });
      // Don't throw - payment method persistence failure shouldn't fail the webhook
    }

    // Handle Zeus subscription if applicable
    await handleZeusSubscription(pi, 'succeeded', new Date());
  }

  /**
   * Handle payment intent failed event
   * Updates payment intent status and handles Zeus subscription notifications
   */
  async handlePaymentIntentFailed(pi: Stripe.PaymentIntent): Promise<void> {
    logger.warn('Payment intent failed', {
      id: pi.id,
      error: pi.last_payment_error?.message,
      code: pi.last_payment_error?.code,
    });

    await this.deps.paymentIntentModel.upsertPaymentIntent(
      mapStripePIToModel(pi)
    );

    // Handle Zeus subscription if applicable
    await handleZeusSubscription(pi, 'failed');
  }

  /**
   * Handle payment intent canceled event
   * Updates payment intent status and handles Zeus subscription notifications
   */
  async handlePaymentIntentCanceled(pi: Stripe.PaymentIntent): Promise<void> {
    logger.info('Payment intent canceled', {
      id: pi.id,
      reason: pi.cancellation_reason,
    });

    await this.deps.paymentIntentModel.upsertPaymentIntent(
      mapStripePIToModel(pi)
    );

    // Handle Zeus subscription if applicable
    await handleZeusSubscription(pi, 'canceled');
  }
}
