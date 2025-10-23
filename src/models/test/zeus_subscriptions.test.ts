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
});
