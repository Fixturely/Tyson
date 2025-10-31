import logger from '../../utils/logger';
import config from '../../../config';
import { computeHMAC } from '../../utils/hmac';
import { buildZeusNotificationPayload } from './helper';

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
  private webhookSecret: string;

  constructor(webhookUrl?: string, webhookSecret?: string) {
    this.zeusWebhookUrl =
      webhookUrl ??
      config.zeus?.webhookUrl ??
      process.env.ZEUS_WEBHOOK_URL ??
      '';
    if (!this.zeusWebhookUrl) {
      logger.warn(
        'ZEUS_WEBHOOK_URL not configured - notifications will be logged only'
      );
    } else {
      this.zeusWebhookUrl += '/v1/subscriptions/webhook';
    }

    this.webhookSecret =
      webhookSecret ?? config.zeus?.webhookSecret ?? '';
    if (!this.webhookSecret) {
      logger.warn(
        'ZEUS_WEBHOOK_SECRET not configured - notifications will be unsigned'
      );
    }
  }

  async notifyPaymentStatus(
    notificationData: ZeusNotificationData
  ): Promise<void> {
    try {
      const payload = buildZeusNotificationPayload(notificationData);

      if (this.zeusWebhookUrl) {
        // Stringify payload once to ensure signature matches body
        const payloadString = JSON.stringify(payload);

        // Prepare headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'Tyson-Billing-Service/1.0',
        };

        // Add HMAC signature if secret is configured
        if (this.webhookSecret) {
          const signature = computeHMAC(payloadString, this.webhookSecret);
          headers['X-Tyson-Signature'] = signature;
        }

        // Send HTTP notification to Zeus
        const response = await fetch(this.zeusWebhookUrl, {
          method: 'POST',
          headers,
          body: payloadString,
        });

        if (!response.ok) {
          throw new Error(
            `Zeus notification failed: ${response.status} ${response.statusText}`
          );
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

  async notifyPaymentSucceeded(
    notificationData: ZeusNotificationData
  ): Promise<void> {
    await this.notifyPaymentStatus({
      ...notificationData,
      status: 'succeeded',
    });
  }

  async notifyPaymentFailed(
    notificationData: ZeusNotificationData
  ): Promise<void> {
    await this.notifyPaymentStatus({
      ...notificationData,
      status: 'failed',
    });
  }

  async notifyPaymentCanceled(
    notificationData: ZeusNotificationData
  ): Promise<void> {
    await this.notifyPaymentStatus({
      ...notificationData,
      status: 'canceled',
    });
  }
}

