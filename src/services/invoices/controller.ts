import Stripe from 'stripe';
import logger from '../../utils/logger';
import { zeusSubscriptionModel } from '../../models/zeus_subscriptions';
import { zeusNotificationService } from '../notifications';
import {
  extractPaymentIntentIdFromInvoice,
  buildNotificationDataFromInvoice,
} from './helper';

export interface InvoicesServiceDependencies {
  zeusSubscriptionModel: typeof zeusSubscriptionModel;
  zeusNotificationService: typeof zeusNotificationService;
}

/**
 * Invoices domain service - handles business logic for Stripe invoice events
 * Primarily handles subscription renewal payments
 */
export class InvoicesService {
  constructor(private deps: InvoicesServiceDependencies) {}

  /**
   * Handle invoice payment succeeded event
   * Updates Zeus subscription status and extends service period
   */
  async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    logger.info('Invoice payment succeeded', {
      invoice_id: invoice.id,
      amount_paid: invoice.amount_paid,
      subscription: invoice.subscription,
    });

    // Extract payment intent ID from invoice
    const paymentIntentId = extractPaymentIntentIdFromInvoice(invoice);
    if (!paymentIntentId) {
      logger.warn('Invoice payment succeeded but no payment intent ID found', {
        invoice_id: invoice.id,
      });
      return;
    }

    // Find Zeus subscription by payment intent
    const subscription =
      await this.deps.zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent(
        paymentIntentId
      );

    if (!subscription) {
      logger.warn('No Zeus subscription found for invoice payment intent', {
        invoice_id: invoice.id,
        payment_intent_id: paymentIntentId,
      });
      return; // Not a Zeus subscription, or already handled
    }

    // Update subscription status and paid_at timestamp
    const paidAt = invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000)
      : new Date();

    await this.deps.zeusSubscriptionModel.updateZeusSubscriptionStatus(
      subscription.subscription_id,
      'succeeded',
      paidAt
    );

    // Notify Zeus about successful renewal
    try {
      const notificationData = buildNotificationDataFromInvoice(
        invoice,
        subscription
      );

      await this.deps.zeusNotificationService.notifyPaymentSucceeded(
        notificationData
      );

      await this.deps.zeusSubscriptionModel.markZeusNotified(
        subscription.subscription_id
      );
    } catch (notificationError) {
      logger.error('Failed to notify Zeus of invoice payment success', {
        subscription_id: subscription.subscription_id,
        invoice_id: invoice.id,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
    }
  }

  /**
   * Handle invoice payment failed event
   * Updates subscription status and handles dunning notifications
   */
  async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    logger.warn('Invoice payment failed', {
      invoice_id: invoice.id,
      amount_due: invoice.amount_due,
      subscription: invoice.subscription,
      attempt_count: invoice.attempt_count,
    });

    // Extract payment intent ID from invoice
    const paymentIntentId = extractPaymentIntentIdFromInvoice(invoice);
    if (!paymentIntentId) {
      logger.warn('Invoice payment failed but no payment intent ID found', {
        invoice_id: invoice.id,
      });
      return;
    }

    // Find Zeus subscription by payment intent
    const subscription =
      await this.deps.zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent(
        paymentIntentId
      );

    if (!subscription) {
      logger.warn(
        'No Zeus subscription found for failed invoice payment intent',
        {
          invoice_id: invoice.id,
          payment_intent_id: paymentIntentId,
        }
      );
      return; // Not a Zeus subscription
    }

    // Update subscription status to failed
    await this.deps.zeusSubscriptionModel.updateZeusSubscriptionStatus(
      subscription.subscription_id,
      'failed'
    );

    // Notify Zeus about failed payment
    try {
      const notificationData = buildNotificationDataFromInvoice(
        invoice,
        subscription
      );

      // Extract error message from invoice
      // For failed invoices, error info can be in charge or we use attempt count
      const errorMessage =
        (invoice as any).last_finalization_error?.message ||
        (invoice.charge as any)?.outcome?.reason ||
        undefined;

      if (errorMessage) {
        notificationData.error_message = errorMessage;
      } else {
        // Fallback: use attempt details
        const attemptMessage =
          invoice.attempt_count && invoice.attempt_count > 0
            ? `Payment attempt ${invoice.attempt_count} failed`
            : 'Payment failed';
        notificationData.error_message = attemptMessage;
      }

      await this.deps.zeusNotificationService.notifyPaymentFailed(
        notificationData
      );
    } catch (notificationError) {
      logger.error('Failed to notify Zeus of invoice payment failure', {
        subscription_id: subscription.subscription_id,
        invoice_id: invoice.id,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
    }

    // TODO: Future enhancement - implement dunning flow
    // - Track attempt count
    // - Schedule retry (Stripe handles this, but we could add grace period)
    // - Send dunning emails after X failed attempts
    // - Cancel subscription after final failure
  }
}
