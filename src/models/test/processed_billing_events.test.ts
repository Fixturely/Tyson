import { ProcessedBillingEventModel, ProcessedBillingEventData } from '../processed_billing_events';
import db from '../../services/database';

// Mock the database
jest.mock('../../services/database', () => {
  const mockRaw = jest.fn().mockReturnValue('NOW() - INTERVAL ? HOUR');
  const mockQueryBuilder = {
    insert: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    first: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    delete: jest.fn().mockResolvedValue(0),
  };

  const mockDb = jest.fn(() => mockQueryBuilder);
  (mockDb as any).raw = mockRaw;

  return {
    __esModule: true,
    default: mockDb,
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ProcessedBillingEventModel', () => {
  let model: ProcessedBillingEventModel;
  let mockDb: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new ProcessedBillingEventModel();
    mockDb = require('../../services/database').default;
    mockQueryBuilder = mockDb('processed_billing_events');
  });

  describe('hasProcessed', () => {
    it('should return false when event not processed', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null);

      const result = await model.hasProcessed('evt_test_123');

      expect(result).toBe(false);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('event_id', 'evt_test_123');
      expect(mockQueryBuilder.first).toHaveBeenCalled();
    });

    it('should return true when event already processed', async () => {
      const mockEvent = {
        id: '123',
        event_id: 'evt_test_456',
        event_type: 'payment_intent.succeeded',
        processed_at: new Date(),
        success: true,
      };
      mockQueryBuilder.first.mockResolvedValueOnce(mockEvent);

      const result = await model.hasProcessed('evt_test_456');

      expect(result).toBe(true);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('event_id', 'evt_test_456');
    });

    it('should handle database errors', async () => {
      mockQueryBuilder.first.mockRejectedValueOnce(new Error('Database error'));

      await expect(model.hasProcessed('evt_test_123')).rejects.toThrow('Database error');
    });
  });

  describe('markProcessed', () => {
    it('should insert new event when not exists', async () => {
      // hasProcessed returns false
      mockQueryBuilder.first.mockResolvedValueOnce(null);

      await model.markProcessed('evt_new_event', 'payment_intent.succeeded', {
        payment_intent_id: 'pi_xyz',
        success: true,
      });

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        event_id: 'evt_new_event',
        event_type: 'payment_intent.succeeded',
        payment_intent_id: 'pi_xyz',
        success: true,
        error_message: null,
        processed_at: expect.any(Date),
      });
    });

    it('should update existing event', async () => {
      const existingEvent = { event_id: 'evt_existing' };
      mockQueryBuilder.first.mockResolvedValueOnce(existingEvent);

      await model.markProcessed('evt_existing', 'payment_intent.succeeded', {
        payment_intent_id: 'pi_updated',
        success: false,
        error: 'Payment failed',
      });

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        processed_at: expect.any(Date),
        success: false,
        error_message: 'Payment failed',
        payment_intent_id: 'pi_updated',
      });
    });

    it('should handle errors during markProcessed', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null);
      mockQueryBuilder.insert.mockRejectedValueOnce(new Error('Insert failed'));

      await expect(
        model.markProcessed('evt_error', 'payment_intent.succeeded', {})
      ).rejects.toThrow('Insert failed');
    });
  });

  describe('cleanup', () => {
    it('should delete old events', async () => {
      mockQueryBuilder.delete.mockResolvedValueOnce(5);

      const result = await model.cleanup(24);

      expect(result).toBe(5);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });

    it('should use default 24 hours', async () => {
      mockQueryBuilder.delete.mockResolvedValueOnce(3);

      await model.cleanup();

      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      mockQueryBuilder.count.mockImplementation((field: string) => {
        if (field === '* as count') {
          return mockQueryBuilder;
        }
        return mockQueryBuilder;
      });

      mockQueryBuilder.first
        .mockResolvedValueOnce({ count: 10 }) // total
        .mockResolvedValueOnce({ count: 2 }); // failed

      const stats = await model.getStats();

      expect(stats).toEqual({
        total_processed: 10,
        failed_count: 2,
      });
    });

    it('should handle null counts', async () => {
      mockQueryBuilder.first
        .mockResolvedValueOnce({ count: null })
        .mockResolvedValueOnce({ count: null });

      const stats = await model.getStats();

      expect(stats).toEqual({
        total_processed: 0,
        failed_count: 0,
      });
    });
  });
});

