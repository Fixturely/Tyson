import db from '../services/database';
import logger from '../utils/logger';

export interface ZeusSubscriptionData {
  id?: number;
  subscription_id: number;
  user_id: number;
  payment_intent_id: string;
  amount: number;
  currency: string;
  status: string;
  sport_id?: number;
  team_id?: number;
  subscription_type?: string;
  customer_email: string;
  customer_name?: string;
  created_at?: Date;
  updated_at?: Date;
  paid_at?: Date;
  zeus_notified_at?: Date;
  zeus_notification_attempts?: number;
}

export class ZeusSubscriptionModel {
  async createZeusSubscription(
    zeusSubscriptionData: ZeusSubscriptionData
  ): Promise<void> {
    try {
      await db('zeus_subscriptions').insert(zeusSubscriptionData);
      logger.info(
        `Zeus subscription created: ${zeusSubscriptionData.subscription_id}`
      );
    } catch (error) {
      logger.error(`Error creating Zeus subscription: ${error}`);
      throw error;
    }
  }

  async getZeusSubscriptionByPaymentIntent(
    paymentIntentId: string
  ): Promise<ZeusSubscriptionData | null> {
    try {
      const subscription = await db('zeus_subscriptions')
        .where('payment_intent_id', paymentIntentId)
        .first();
      
      return subscription as ZeusSubscriptionData | null;
    } catch (error) {
      logger.error(`Error getting Zeus subscription by payment intent: ${error}`);
      throw error;
    }
  }

  async updateZeusSubscriptionStatus(
    subscriptionId: number,
    status: string,
    paidAt?: Date
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date(),
      };
      
      if (paidAt) {
        updateData.paid_at = paidAt;
      }

      await db('zeus_subscriptions')
        .where('subscription_id', subscriptionId)
        .update(updateData);
      
      logger.info(`Zeus subscription ${subscriptionId} status updated to ${status}`);
    } catch (error) {
      logger.error(`Error updating Zeus subscription status: ${error}`);
      throw error;
    }
  }

  async markZeusNotified(
    subscriptionId: number,
    attempts: number = 1
  ): Promise<void> {
    try {
      await db('zeus_subscriptions')
        .where('subscription_id', subscriptionId)
        .update({
          zeus_notified_at: new Date(),
          zeus_notification_attempts: attempts,
          updated_at: new Date(),
        });
      
      logger.info(`Zeus subscription ${subscriptionId} marked as notified`);
    } catch (error) {
      logger.error(`Error marking Zeus subscription as notified: ${error}`);
      throw error;
    }
  }
}

export const zeusSubscriptionModel = new ZeusSubscriptionModel();
