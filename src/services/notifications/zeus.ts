import logger from '../../utils/logger';
import config from '../../../config';

export interface ZeusNotificationData {
  subscription_id: number;
  user_id: number;
  payment_intent_id: string;
  status?: 'succeeded' | 'failed' | 'canceled';
  amount: number;
  currency: string;
  paid_at?: Date;
  error_message?: string;
  metadata?: {
    sport_id?: number;
    team_id?: number;
    subscription_type?: string;
  };
}

export class ZeusNotificationService {
  private zeusWebhookUrl: string;

  constructor() {
    this.zeusWebhookUrl = config.zeus?.webhookUrl || process.env.ZEUS_WEBHOOK_URL || '';
    if (!this.zeusWebhookUrl) {
      logger.warn('ZEUS_WEBHOOK_URL not configured - notifications will be logged only');
    } else {
      this.zeusWebhookUrl += '/api/v1/subscriptions/webhook';
    }
  }

  async notifyPaymentStatus(notificationData: ZeusNotificationData): Promise<void> {
    try {
      const payload = {
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

      if (this.zeusWebhookUrl) {
        // Send HTTP notification to Zeus
        const response = await fetch(this.zeusWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Tyson-Billing-Service/1.0',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Zeus notification failed: ${response.status} ${response.statusText}`);
        }

        logger.info('Zeus notification sent successfully', {
          subscription_id: notificationData.subscription_id,
          status: notificationData.status,
          response_status: response.status,
        });
      } else {
        // Log notification for development/testing
        logger.info('Zeus notification (webhook URL not configured)', payload);
      }
    } catch (error) {
      logger.error('Failed to send Zeus notification', {
        subscription_id: notificationData.subscription_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async notifyPaymentSucceeded(notificationData: ZeusNotificationData): Promise<void> {
    await this.notifyPaymentStatus({
      ...notificationData,
      status: 'succeeded',
    });
  }

  async notifyPaymentFailed(notificationData: ZeusNotificationData): Promise<void> {
    await this.notifyPaymentStatus({
      ...notificationData,
      status: 'failed',
    });
  }

  async notifyPaymentCanceled(notificationData: ZeusNotificationData): Promise<void> {
    await this.notifyPaymentStatus({
      ...notificationData,
      status: 'canceled',
    });
  }
}

export const zeusNotificationService = new ZeusNotificationService();
