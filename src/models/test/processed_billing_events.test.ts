import { ProcessedBillingEventModel } from '../processed_billing_events';

// Mock the database
jest.mock('../../services/database', () => {
  const mockRaw = jest.fn().mockReturnValue('NOW() - INTERVAL ? HOUR');
  const mockQueryBuilder = {
    insert: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    first: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    delete: jest.fn().mockResolvedValue(0),
    onConflict: jest.fn().mockReturnThis(),
    merge: jest.fn().mockResolvedValue(1),
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
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'event_id',
        'evt_test_123'
      );
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('id');
      expect(mockQueryBuilder.first).toHaveBeenCalled();
    });

    it('should return true when event already processed', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce({ id: 123 });

      const result = await model.hasProcessed('evt_test_456');

      expect(result).toBe(true);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'event_id',
        'evt_test_456'
      );
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('id');
    });

    it('should handle database errors', async () => {
      mockQueryBuilder.first.mockRejectedValueOnce(new Error('Database error'));

      await expect(model.hasProcessed('evt_test_123')).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('markProcessed', () => {
    it('should use upsert to insert or update event', async () => {
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
      expect(mockQueryBuilder.onConflict).toHaveBeenCalledWith('event_id');
      expect(mockQueryBuilder.merge).toHaveBeenCalledWith({
        payment_intent_id: 'pi_xyz',
        processed_at: expect.any(Date),
        success: true,
        error_message: null,
        updated_at: expect.any(Date),
      });
    });

    it('should update existing event with new metadata', async () => {
      await model.markProcessed('evt_existing', 'payment_intent.succeeded', {
        payment_intent_id: 'pi_updated',
        success: false,
        error: 'Payment failed',
      });

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        event_id: 'evt_existing',
        event_type: 'payment_intent.succeeded',
        payment_intent_id: 'pi_updated',
        success: false,
        error_message: 'Payment failed',
        processed_at: expect.any(Date),
      });
      expect(mockQueryBuilder.onConflict).toHaveBeenCalledWith('event_id');
      expect(mockQueryBuilder.merge).toHaveBeenCalledWith({
        payment_intent_id: 'pi_updated',
        processed_at: expect.any(Date),
        success: false,
        error_message: 'Payment failed',
        updated_at: expect.any(Date),
      });
    });

    it('should handle errors during markProcessed', async () => {
      mockQueryBuilder.merge.mockRejectedValueOnce(new Error('Upsert failed'));

      await expect(
        model.markProcessed('evt_error', 'payment_intent.succeeded', {})
      ).rejects.toThrow('Upsert failed');
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
