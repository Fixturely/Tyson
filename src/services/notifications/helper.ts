import { ZeusNotificationData } from './controller';

/**
 * Build payload for Zeus notification
 */
export function buildZeusNotificationPayload(
  notificationData: ZeusNotificationData
) {
  return {
    subscription_id: notificationData.subscription_id,
    user_id: notificationData.user_id,
    payment_intent_id: notificationData.payment_intent_id,
    status: notificationData.status,
    amount: notificationData.amount,
    currency: notificationData.currency,
    paid_at: notificationData.paid_at?.toISOString(),
    error_message: notificationData.error_message,
    metadata: notificationData.metadata,
    timestamp: new Date().toISOString(),
  };
}

