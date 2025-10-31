import Stripe from 'stripe';
import { ZeusNotificationData } from '../notifications';
import type { ZeusSubscriptionData } from '../../models/zeus_subscriptions';
import { buildMetadata, ZeusSubscription } from '../payments/helper';

/**
 * Extract payment intent ID from Stripe Invoice
 * Invoices can have payment_intent as string or object
 */
export function extractPaymentIntentIdFromInvoice(
  invoice: Stripe.Invoice
): string | undefined {
  if (!invoice.payment_intent) {
    return undefined;
  }

  if (typeof invoice.payment_intent === 'string') {
    return invoice.payment_intent;
  }

  if (typeof invoice.payment_intent === 'object' && invoice.payment_intent) {
    return invoice.payment_intent.id;
  }

  return undefined;
}

/**
 * Build Zeus notification data from invoice and subscription
 */
export function buildNotificationDataFromInvoice(
  invoice: Stripe.Invoice,
  subscription: ZeusSubscriptionData
): ZeusNotificationData {
  // Convert subscription to ZeusSubscription format for metadata building
  // Only include defined properties to satisfy exactOptionalPropertyTypes
  const zeusSub: ZeusSubscription = {};

  if (subscription.sport_id != null) {
    zeusSub.sport_id = subscription.sport_id;
  }
  if (subscription.team_id != null) {
    zeusSub.team_id = subscription.team_id;
  }
  if (subscription.subscription_type != null) {
    zeusSub.subscription_type = subscription.subscription_type;
  }

  const metadata = buildMetadata(zeusSub);

  const notificationData: ZeusNotificationData = {
    subscription_id: subscription.subscription_id,
    user_id: subscription.user_id,
    payment_intent_id: extractPaymentIntentIdFromInvoice(invoice) || '',
    amount: invoice.amount_paid || invoice.amount_due || 0,
    currency: invoice.currency || subscription.currency,
    metadata: metadata ?? {},
  };

  // Add paid_at for successful payments
  if (invoice.status === 'paid' && invoice.status_transitions?.paid_at) {
    notificationData.paid_at = new Date(
      invoice.status_transitions.paid_at * 1000
    );
  }

  return notificationData;
}
