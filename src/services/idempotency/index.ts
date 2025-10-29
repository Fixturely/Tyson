import { processedBillingEventModel } from '../../models/processed_billing_events';

/**
 * Idempotency key store - now backed by database
 * Prevents duplicate webhook processing
 */
class IdempotencyKeyStore {
  // Function to check if event is already processed
  async hasProcessed(eventId: string): Promise<boolean> {
    return await processedBillingEventModel.hasProcessed(eventId);
  }

  // Function to mark event as processed (insert or update)
  async markProcessed(
    eventId: string,
    eventType: string,
    metadata: { payment_intent_id?: string; success?: boolean; error?: string }
  ): Promise<void> {
    await processedBillingEventModel.markProcessed(eventId, eventType, metadata);
  }

  // Clean up old events (cleanup every 24 hours)
  async cleanup(maxAgeHours: number = 24): Promise<void> {
    await processedBillingEventModel.cleanup(maxAgeHours);
  }

  // Get stats (for monitoring)
  async getStats() {
    return await processedBillingEventModel.getStats();
  }

  // For testing purposes only
  public async reset(): Promise<void> {
    // Note: In production, you might want to delete test data manually
    // This method is primarily for test cleanup
  }
}

export const idempotencyKeyStore = new IdempotencyKeyStore();
