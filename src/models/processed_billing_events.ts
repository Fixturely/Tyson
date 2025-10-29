import db from "../services/database";
import logger from "../utils/logger";

export interface ProcessedBillingEventData {
  id?: string;
  event_id: string;
  event_type: string;
  payment_intent_id?: string | null;
  processed_at: Date;
  success: boolean;
  error_message?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export class ProcessedBillingEventModel {
    async createProcessedBillingEvent(eventData: ProcessedBillingEventData): Promise<void> {
        try {
            await db('processed_billing_events').insert(eventData);
        } catch (error) {
            logger.error(`Error creating processed billing event: ${error}`);
            throw error;
        }
    }

    async getProcessedBillingEventById(id: string): Promise<ProcessedBillingEventData | null> {
        try {
            const event = await db('processed_billing_events').where('id', id).first();
            return event as unknown as ProcessedBillingEventData | null;
        } catch (error) {
            logger.error(`Error getting processed billing event by id: ${error}`);
            throw error;
        }
    }

    async getProcessedBillingEventsByEventId(eventId: string): Promise<ProcessedBillingEventData | null> {
        try {
            const event = await db('processed_billing_events')
                .where('event_id', eventId)
                .first();
            return event as ProcessedBillingEventData | null;
        } catch (error) {
            logger.error(`Error getting processed billing events by event id: ${error}`);
            throw error;
        }
    }

    async hasProcessed(eventId: string): Promise<boolean> {
        try {
            const event = await this.getProcessedBillingEventsByEventId(eventId);
            return event !== null;
        } catch (error) {
            logger.error(`Error checking if event has been processed: ${error}`);
            throw error;
        }
    }


    async markProcessed(
        eventId: string, 
        eventType: string, 
        metadata: { payment_intent_id?: string; success?: boolean; error?: string }
    ): Promise<void> {
        try {
            const existing = await this.hasProcessed(eventId);
            
            if (existing) {
                // Update existing record
                await db('processed_billing_events')
                    .where('event_id', eventId)
                    .update({
                        processed_at: new Date(),
                        success: metadata.success ?? true,
                        error_message: metadata.error || null,
                        payment_intent_id: metadata.payment_intent_id,
                    });
                logger.info(`Updated processed billing event: ${eventId}`);
            } else {
                // Insert new record
                await db('processed_billing_events').insert({
                    event_id: eventId,
                    event_type: eventType,
                    payment_intent_id: metadata.payment_intent_id || null,
                    processed_at: new Date(),
                    success: metadata.success ?? true,
                    error_message: metadata.error || null,
                });
                logger.info(`Created processed billing event: ${eventId}`);
            }
        } catch (error) {
            logger.error(`Error marking event as processed: ${error}`);
            throw error;
        }
    }

    async cleanup(maxAgeHours: number = 24): Promise<number> {
        try {
            const result = await db('processed_billing_events')
                .where('processed_at', '<', db.raw('NOW() - INTERVAL ? HOUR', [maxAgeHours]))
                .delete();
            
            logger.info(`Cleaned up ${result} old processed billing events`);
            return result;
        } catch (error) {
            logger.error(`Error cleaning up processed billing events: ${error}`);
            throw error;
        }
    }

    async getStats() {
        try {
            const total = await db('processed_billing_events')
                .count('* as count')
                .first();
            
            const failed = await db('processed_billing_events')
                .where('success', false)
                .count('* as count')
                .first();
            
            return {
                total_processed: parseInt(total?.count?.toString() || '0', 10),
                failed_count: parseInt(failed?.count?.toString() || '0', 10),
            };
        } catch (error) {
            logger.error(`Error getting processed billing events stats: ${error}`);
            throw error;
        }
    }
}

export const processedBillingEventModel = new ProcessedBillingEventModel();
