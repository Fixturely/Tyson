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
}

export const zeusSubscriptionModel = new ZeusSubscriptionModel();
