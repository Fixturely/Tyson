import Stripe from 'stripe';
import logger from '../../utils/logger';
import type { PaymentIntentData } from '../../models/payment_intent';
import { zeusSubscriptionModel } from '../../models/zeus_subscriptions';
import {
  ZeusNotificationData,
  zeusNotificationService,
} from '../notifications';

// Types for Zeus subscription and metadata
export interface ZeusSubscription {
  sport_id?: number;
  team_id?: number;
  subscription_type?: string;
  [key: string]: any;
}

export interface ZeusSubscriptionMetadata {
  sport_id?: number;
  team_id?: number;
  subscription_type?: string;
}

/**
 * Extract customer ID from Stripe PaymentIntent
 */
export function extractCustomerId(pi: Stripe.PaymentIntent): string | undefined {
  return pi.customer
    ? typeof pi.customer === 'string'
      ? pi.customer
      : pi.customer.id
    : undefined;
}

/**
 * Extract payment method ID from Stripe PaymentIntent
 */
export function extractPaymentMethodId(pi: Stripe.PaymentIntent): string | undefined {
  return pi.payment_method
    ? typeof pi.payment_method === 'string'
      ? pi.payment_method
      : (pi.payment_method as Stripe.PaymentMethod).id
    : undefined;
}

/**
 * Normalize Stripe PaymentIntent into our DB shape
 */
export function mapStripePIToModel(pi: Stripe.PaymentIntent): PaymentIntentData {
  let model: PaymentIntentData = {
    id: pi.id,
    amount: pi.amount,
    currency: pi.currency,
    status: pi.status,
    created: pi.created,
  };

  const customerId = extractCustomerId(pi);
  if (customerId) model.customer_id = customerId;

  if (pi.description != null) model.description = pi.description;
  if (pi.metadata != null) model.metadata = pi.metadata;

  const paymentMethod = extractPaymentMethodId(pi);
  if (paymentMethod) model.payment_method = paymentMethod;

  if (pi.client_secret != null) model.client_secret = pi.client_secret;

  return model;
}

/**
 * Build metadata object from Zeus subscription
 */
export function buildMetadata(
  subscription: ZeusSubscription
): ZeusSubscriptionMetadata | undefined {
  const metadata: ZeusSubscriptionMetadata = {};
  if (subscription.sport_id) metadata.sport_id = subscription.sport_id;
  if (subscription.team_id) metadata.team_id = subscription.team_id;
  if (subscription.subscription_type)
    metadata.subscription_type = subscription.subscription_type;
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Handle Zeus subscription processing
 * Updates subscription status and sends notifications to Zeus
 */
export async function handleZeusSubscription(
  paymentIntent: Stripe.PaymentIntent,
  status: 'succeeded' | 'failed' | 'canceled',
  paidAt?: Date
): Promise<void> {
  const subscription =
    await zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent(
      paymentIntent.id
    );

  if (!subscription) {
    logger.warn('No Zeus subscription found for payment intent', {
      payment_intent_id: paymentIntent.id,
    });
    return; // Not a Zeus subscription
  }

  // Update subscription status
  await zeusSubscriptionModel.updateZeusSubscriptionStatus(
    subscription.subscription_id,
    status,
    paidAt
  );

  // Notify Zeus about payment status
  try {
    const metadata = buildMetadata(subscription);
    const notificationData: ZeusNotificationData = {
      subscription_id: subscription.subscription_id,
      user_id: subscription.user_id,
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      metadata: metadata ?? {},
    };

    // Add status-specific fields
    if (status === 'succeeded') {
      notificationData.paid_at = paidAt || new Date();
      await zeusNotificationService.notifyPaymentSucceeded(notificationData);
      await zeusSubscriptionModel.markZeusNotified(
        subscription.subscription_id
      );
    } else if (status === 'failed') {
      if (paymentIntent.last_payment_error?.message != null) {
        notificationData.error_message =
          paymentIntent.last_payment_error?.message;
      } else {
        notificationData.error_message = 'Unknown failure reason';
      }
      await zeusNotificationService.notifyPaymentFailed(notificationData);
    } else if (status === 'canceled') {
      if (paymentIntent.cancellation_reason != null) {
        notificationData.error_message = paymentIntent.cancellation_reason;
      } else {
        notificationData.error_message = 'Unknown cancellation reason';
      }
      await zeusNotificationService.notifyPaymentCanceled(notificationData);
    }
  } catch (notificationError) {
    logger.error(`Failed to notify Zeus of ${status} payment`, {
      subscription_id: subscription.subscription_id,
      error:
        notificationError instanceof Error
          ? notificationError.message
          : String(notificationError),
      errorStack:
        notificationError instanceof Error
          ? notificationError.stack
          : undefined,
    });
  }
}

