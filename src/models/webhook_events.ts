import db from '../services/database';
import logger from '../utils/logger';

export interface WebhookEventData {
  id: string;
  type: string;
  payment_intent_id?: string;
  data: any;
  processed?: boolean;
  processingError?: string;
}

export class WebhookEventDbService {
  async createWebhookEvent(eventData: WebhookEventData): Promise<void> {
    try {
      await db('webhook_events').insert({
        id: eventData.id,
        type: eventData.type,
        payment_intent_id: eventData.payment_intent_id,
        data: eventData.data,
        processed: eventData.processed,
        processing_error: eventData.processingError,
        received_at: new Date(),
      });
      logger.info(`Webhook event created: ${eventData.id}`);
    } catch (error) {
      logger.error(`Error creating webhook event: ${error}`);
      throw error;
    }
  }

  async markWebhookEventAsProcessed(
    eventId: string,
    processingError?: string
  ): Promise<void> {
    try {
      await db('webhook_events')
        .where('id', eventId)
        .update({
          processed: true,
          processed_at: new Date(),
          processing_error: processingError || null,
        });
      logger.info(`Webhook event marked as processed: ${eventId}`);
    } catch (error) {
      logger.error(`Error marking webhook event as processed: ${error}`);
      throw error;
    }
  }

  async getWebhookEventById(eventId: string): Promise<WebhookEventData | null> {
    try {
      const event = await db('webhook_events').where('id', eventId).first();
      return event as WebhookEventData | null;
    } catch (error) {
      logger.error(`Error getting webhook event by id: ${error}`);
      throw error;
    }
  }

  async getUnprocessedEvents(): Promise<WebhookEventData[]> {
    try {
      const events = await db('webhook_events')
        .where('processed', false)
        .orderBy('received_at', 'asc');

      return events;
    } catch (error) {
      logger.error('Failed to get unprocessed events', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

export const webhookEventDbService = new WebhookEventDbService();
