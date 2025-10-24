import {
  ZeusSubscriptionData,
  ZeusSubscriptionModel,
} from '../zeus_subscriptions';

// Mock the database module - Knex instance that returns query builders
jest.mock('../../services/database', () => {
  const mockQueryBuilder = {
    insert: jest.fn().mockResolvedValue([1]),
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    first: jest.fn().mockResolvedValue(null),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue([]),
  };

  return {
    __esModule: true,
    default: jest.fn(() => mockQueryBuilder),
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ZeusSubscriptionModel', () => {
  let model: ZeusSubscriptionModel;
  let mockDb: any;
  let mockQueryBuilder: any;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new ZeusSubscriptionModel();

    // Get references to the mocked functions
    mockDb = require('../../services/database').default;
    mockQueryBuilder = mockDb();
    mockLogger = require('../../utils/logger').default;
  });

  describe('createZeusSubscription', () => {
    it('should create a zeus-subscription successfully', async () => {
      const zeusSubscriptionData: ZeusSubscriptionData = {
        subscription_id: 123,
        user_id: 123,
        payment_intent_id: 'pi_123',
        amount: 5000,
        currency: 'usd',
        status: 'pending',
        customer_email: 'test@test.com',
        customer_name: 'John Doe',
      };
      await model.createZeusSubscription(zeusSubscriptionData);

      // Verify database was called with correct table name
      expect(mockDb).toHaveBeenCalledWith('zeus_subscriptions');

      // Verify insert was called with correct data
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        zeusSubscriptionData
      );
    });

    it('should throw an error if the database insertion fails', async () => {
      const zeusSubscriptionData: ZeusSubscriptionData = {
        subscription_id: 123,
        user_id: 123,
        payment_intent_id: 'pi_123',
        amount: 5000,
        currency: 'usd',
        status: 'pending',
        customer_email: 'test@test.com',
        customer_name: 'John Doe',
      };
      const dbError = new Error('Database connection failed');
      mockQueryBuilder.insert.mockRejectedValueOnce(dbError);
      await expect(
        model.createZeusSubscription(zeusSubscriptionData)
      ).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error creating Zeus subscription: ${dbError}`
      );
    });
  });

  describe('getZeusSubscriptionByPaymentIntent', () => {
    it('should retrieve a Zeus subscription by payment intent ID', async () => {
      const mockSubscription = {
        id: 1,
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        status: 'pending',
        customer_email: 'test@test.com',
        customer_name: 'John Doe',
      };

      mockQueryBuilder.first.mockResolvedValueOnce(mockSubscription);

      const result =
        await model.getZeusSubscriptionByPaymentIntent('pi_test_123');

      expect(mockDb).toHaveBeenCalledWith('zeus_subscriptions');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'payment_intent_id',
        'pi_test_123'
      );
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(result).toEqual(mockSubscription);
    });

    it('should return null when subscription not found', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null);

      const result =
        await model.getZeusSubscriptionByPaymentIntent('pi_nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database query failed');
      mockQueryBuilder.first.mockRejectedValueOnce(dbError);

      await expect(
        model.getZeusSubscriptionByPaymentIntent('pi_test_123')
      ).rejects.toThrow('Database query failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting Zeus subscription by payment intent: Error: Database query failed'
      );
    });
  });

  describe('updateZeusSubscriptionStatus', () => {
    it('should update subscription status successfully', async () => {
      await model.updateZeusSubscriptionStatus(123, 'succeeded');

      expect(mockDb).toHaveBeenCalledWith('zeus_subscriptions');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'subscription_id',
        123
      );
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        status: 'succeeded',
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Zeus subscription 123 status updated to succeeded'
      );
    });

    it('should update subscription status with paid_at timestamp', async () => {
      const paidAt = new Date('2025-01-24T01:42:25.000Z');
      await model.updateZeusSubscriptionStatus(123, 'succeeded', paidAt);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        status: 'succeeded',
        paid_at: paidAt,
      });
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database update failed');
      mockQueryBuilder.update.mockRejectedValueOnce(dbError);

      await expect(
        model.updateZeusSubscriptionStatus(123, 'succeeded')
      ).rejects.toThrow('Database update failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error updating Zeus subscription status: Error: Database update failed'
      );
    });
  });

  describe('markZeusNotified', () => {
    it('should mark Zeus subscription as notified successfully', async () => {
      await model.markZeusNotified(123);

      expect(mockDb).toHaveBeenCalledWith('zeus_subscriptions');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'subscription_id',
        123
      );
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        zeus_notified_at: expect.any(Date),
        zeus_notification_attempts: 1,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Zeus subscription 123 marked as notified'
      );
    });

    it('should mark Zeus subscription as notified with custom attempts', async () => {
      await model.markZeusNotified(123, 3);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        zeus_notified_at: expect.any(Date),
        zeus_notification_attempts: 3,
      });
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database update failed');
      mockQueryBuilder.update.mockRejectedValueOnce(dbError);

      await expect(model.markZeusNotified(123)).rejects.toThrow(
        'Database update failed'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error marking Zeus subscription as notified: Error: Database update failed'
      );
    });
  });
});
