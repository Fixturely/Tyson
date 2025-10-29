import { idempotencyKeyStore } from './index';
import { processedBillingEventModel } from '../../models/processed_billing_events';

// Mock the processed billing events model
jest.mock('../../models/processed_billing_events', () => ({
  processedBillingEventModel: {
    hasProcessed: jest.fn(),
    markProcessed: jest.fn(),
    cleanup: jest.fn(),
    getStats: jest.fn(),
  },
}));

describe('Idempotency Key Store (Database-backed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hasProcessed', () => {
    it('should return false when event not processed', async () => {
      (processedBillingEventModel.hasProcessed as jest.Mock).mockResolvedValue(
        false
      );

      const result = await idempotencyKeyStore.hasProcessed('evt_test_123');

      expect(result).toBe(false);
      expect(processedBillingEventModel.hasProcessed).toHaveBeenCalledWith(
        'evt_test_123'
      );
    });

    it('should return true when event already processed', async () => {
      (processedBillingEventModel.hasProcessed as jest.Mock).mockResolvedValue(
        true
      );

      const result = await idempotencyKeyStore.hasProcessed('evt_test_123');

      expect(result).toBe(true);
      expect(processedBillingEventModel.hasProcessed).toHaveBeenCalledWith(
        'evt_test_123'
      );
    });
  });

  describe('markProcessed', () => {
    it('should mark event as processed with metadata', async () => {
      const eventId = 'evt_test_456';
      const eventType = 'payment_intent.succeeded';
      const metadata = {
        payment_intent_id: 'pi_xyz789',
        success: true,
      };

      await idempotencyKeyStore.markProcessed(eventId, eventType, metadata);

      expect(processedBillingEventModel.markProcessed).toHaveBeenCalledWith(
        eventId,
        eventType,
        metadata
      );
    });

    it('should mark failed event with error message', async () => {
      const eventId = 'evt_test_789';
      const eventType = 'payment_intent.payment_failed';
      const metadata = {
        payment_intent_id: 'pi_abc123',
        success: false,
        error: 'Card declined',
      };

      await idempotencyKeyStore.markProcessed(eventId, eventType, metadata);

      expect(processedBillingEventModel.markProcessed).toHaveBeenCalledWith(
        eventId,
        eventType,
        metadata
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup old processed events', async () => {
      (processedBillingEventModel.cleanup as jest.Mock).mockResolvedValue(5);

      await idempotencyKeyStore.cleanup(24);

      expect(processedBillingEventModel.cleanup).toHaveBeenCalledWith(24);
    });

    it('should use default cleanup hours when not specified', async () => {
      await idempotencyKeyStore.cleanup();

      expect(processedBillingEventModel.cleanup).toHaveBeenCalledWith(24);
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      const mockStats = {
        total_processed: 10,
        failed_count: 2,
      };

      (processedBillingEventModel.getStats as jest.Mock).mockResolvedValue(
        mockStats
      );

      const stats = await idempotencyKeyStore.getStats();

      expect(stats).toEqual(mockStats);
      expect(processedBillingEventModel.getStats).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset without errors', async () => {
      await expect(idempotencyKeyStore.reset()).resolves.not.toThrow();
    });
  });
});
