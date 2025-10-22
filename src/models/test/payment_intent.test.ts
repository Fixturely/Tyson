import { PaymentIntentModel } from '../payment_intent';
import { PaymentIntentData } from '../payment_intent';

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

describe('PaymentIntentModel', () => {
  let model: PaymentIntentModel;
  let mockDb: any;
  let mockQueryBuilder: any;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new PaymentIntentModel();
    
    // Get references to the mocked functions
    mockDb = require('../../services/database').default;
    mockQueryBuilder = mockDb();
    mockLogger = require('../../utils/logger').default;
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent successfully', async () => {
      const paymentIntentData: PaymentIntentData = {
        id: 'pi_123',
        amount: 5000,
        currency: 'usd',
        status: 'requires_payment_method',
        customer_id: 'cus_123',
        description: 'Test payment',
        metadata: { order_id: 'order_123' },
        client_secret: 'pi_123_secret_abc',
        created: 1697923500,
        payment_method: 'pm_card_visa',
      };

      await model.createPaymentIntent(paymentIntentData);

      // Verify database was called with correct table name
      expect(mockDb).toHaveBeenCalledWith('payment_intents');
      
      // Verify insert was called with correct data
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(paymentIntentData);

      // Verify logger was called
      expect(mockLogger.info).toHaveBeenCalledWith(`Payment intent created: ${paymentIntentData.id}`);
    });

    it('should create payment intent with minimal data', async () => {
      const paymentIntentData: PaymentIntentData = {
        id: 'pi_456',
        amount: 2000,
        currency: 'eur',
        status: 'succeeded',
      };

      await model.createPaymentIntent(paymentIntentData);

      expect(mockDb).toHaveBeenCalledWith('payment_intents');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(paymentIntentData);
      expect(mockLogger.info).toHaveBeenCalledWith(`Payment intent created: ${paymentIntentData.id}`);
    });

    it('should handle database errors and log them', async () => {
      const paymentIntentData: PaymentIntentData = {
        id: 'pi_123',
        amount: 5000,
        currency: 'usd',
        status: 'requires_payment_method',
      };

      const dbError = new Error('Database connection failed');
      mockQueryBuilder.insert.mockRejectedValueOnce(dbError);

      await expect(model.createPaymentIntent(paymentIntentData)).rejects.toThrow('Database connection failed');
      
      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(`Error creating payment intent: ${dbError}`);
    });
  });

  describe('updatePaymentIntent', () => {
    it('should update a payment intent successfully', async () => {
      const paymentIntentData: PaymentIntentData = {
        id: 'pi_123',
        amount: 5000,
        currency: 'usd',
        status: 'succeeded',
        customer_id: 'cus_123',
        description: 'Updated payment',
        metadata: { order_id: 'order_123' },
        client_secret: 'pi_123_secret_abc',
        created: 1697923500,
        payment_method: 'pm_card_visa',
      };

      await model.updatePaymentIntent(paymentIntentData);

      expect(mockDb).toHaveBeenCalledWith('payment_intents');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id', paymentIntentData.id);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(paymentIntentData);
      expect(mockLogger.info).toHaveBeenCalledWith(`Payment intent updated: ${paymentIntentData.id}`);
    });

    it('should update payment intent with partial data', async () => {
      const paymentIntentData: PaymentIntentData = {
        id: 'pi_456',
        amount: 2000,
        currency: 'eur',
        status: 'failed',
      };

      await model.updatePaymentIntent(paymentIntentData);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id', paymentIntentData.id);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(paymentIntentData);
      expect(mockLogger.info).toHaveBeenCalledWith(`Payment intent updated: ${paymentIntentData.id}`);
    });

    it('should handle database errors when updating payment intent', async () => {
      const paymentIntentData: PaymentIntentData = {
        id: 'pi_123',
        amount: 5000,
        currency: 'usd',
        status: 'succeeded',
      };

      const dbError = new Error('Update failed');
      mockQueryBuilder.update.mockRejectedValueOnce(dbError);

      await expect(model.updatePaymentIntent(paymentIntentData)).rejects.toThrow('Update failed');
      expect(mockLogger.error).toHaveBeenCalledWith(`Error updating payment intent: ${dbError}`);
    });
  });

  describe('getPaymentIntentById', () => {
    it('should retrieve payment intent by id successfully', async () => {
      const paymentIntentId = 'pi_123';
      const mockPaymentIntent = {
        id: paymentIntentId,
        amount: 5000,
        currency: 'usd',
        status: 'succeeded',
        customer_id: 'cus_123',
        description: 'Test payment',
        metadata: { order_id: 'order_123' },
        client_secret: 'pi_123_secret_abc',
        created: 1697923500,
        payment_method: 'pm_card_visa',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueryBuilder.first.mockResolvedValueOnce(mockPaymentIntent);

      const result = await model.getPaymentIntentById(paymentIntentId);

      expect(mockDb).toHaveBeenCalledWith('payment_intents');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id', paymentIntentId);
      expect(result).toEqual(mockPaymentIntent);
    });

    it('should return null when payment intent not found', async () => {
      const paymentIntentId = 'pi_nonexistent';
      mockQueryBuilder.first.mockResolvedValueOnce(null);

      const result = await model.getPaymentIntentById(paymentIntentId);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id', paymentIntentId);
      expect(result).toBeNull();
    });

    it('should handle database errors when getting payment intent', async () => {
      const paymentIntentId = 'pi_123';
      const dbError = new Error('Query failed');
      mockQueryBuilder.first.mockRejectedValueOnce(dbError);

      await expect(model.getPaymentIntentById(paymentIntentId)).rejects.toThrow('Query failed');
      expect(mockLogger.error).toHaveBeenCalledWith(`Error getting payment intent by id: ${dbError}`);
    });
  });

  describe('getPaymentIntentsByCustomer', () => {
    it('should retrieve payment intents by customer successfully', async () => {
      const customerId = 'cus_123';
      const mockPaymentIntents = [
        {
          id: 'pi_1',
          amount: 1000,
          currency: 'usd',
          status: 'succeeded',
          customer_id: customerId,
          created_at: new Date('2023-01-01'),
        },
        {
          id: 'pi_2',
          amount: 2000,
          currency: 'usd',
          status: 'failed',
          customer_id: customerId,
          created_at: new Date('2023-01-02'),
        },
      ];

      mockQueryBuilder.offset.mockResolvedValueOnce(mockPaymentIntents);

      const result = await model.getPaymentIntentsByCustomer(customerId);

      expect(mockDb).toHaveBeenCalledWith('payment_intents');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('customer_id', customerId);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
      expect(result).toEqual(mockPaymentIntents);
    });

    it('should handle custom limit and offset', async () => {
      const customerId = 'cus_123';
      const limit = 10;
      const offset = 20;
      const mockPaymentIntents: PaymentIntentData[] = [];

      mockQueryBuilder.offset.mockResolvedValueOnce(mockPaymentIntents);

      const result = await model.getPaymentIntentsByCustomer(customerId, limit, offset);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(limit);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(offset);
      expect(result).toEqual(mockPaymentIntents);
    });

    it('should handle database errors when getting payment intents by customer', async () => {
      const customerId = 'cus_123';
      const dbError = new Error('Query failed');
      mockQueryBuilder.offset.mockRejectedValueOnce(dbError);

      await expect(model.getPaymentIntentsByCustomer(customerId)).rejects.toThrow('Query failed');
      expect(mockLogger.error).toHaveBeenCalledWith(`Error getting payment intents by customer: ${dbError}`);
    });
  });

  describe('getPaymentIntentsByStatus', () => {
    it('should retrieve payment intents by status successfully', async () => {
      const status = 'succeeded';
      const mockPaymentIntents = [
        {
          id: 'pi_1',
          amount: 1000,
          currency: 'usd',
          status: status,
          created_at: new Date('2023-01-01'),
        },
        {
          id: 'pi_2',
          amount: 2000,
          currency: 'usd',
          status: status,
          created_at: new Date('2023-01-02'),
        },
      ];

      mockQueryBuilder.offset.mockResolvedValueOnce(mockPaymentIntents);

      const result = await model.getPaymentIntentsByStatus(status);

      expect(mockDb).toHaveBeenCalledWith('payment_intents');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('status', status);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
      expect(result).toEqual(mockPaymentIntents);
    });

    it('should handle database errors when getting payment intents by status', async () => {
      const status = 'failed';
      const dbError = new Error('Query failed');
      mockQueryBuilder.offset.mockRejectedValueOnce(dbError);

      await expect(model.getPaymentIntentsByStatus(status)).rejects.toThrow('Query failed');
      expect(mockLogger.error).toHaveBeenCalledWith(`Error getting payment intents by status: ${dbError}`);
    });
  });

  describe('getAllPaymentIntents', () => {
    it('should retrieve all payment intents successfully', async () => {
      const mockPaymentIntents = [
        {
          id: 'pi_1',
          amount: 1000,
          currency: 'usd',
          status: 'succeeded',
          created_at: new Date('2023-01-01'),
        },
        {
          id: 'pi_2',
          amount: 2000,
          currency: 'usd',
          status: 'failed',
          created_at: new Date('2023-01-02'),
        },
      ];

      mockQueryBuilder.offset.mockResolvedValueOnce(mockPaymentIntents);

      const result = await model.getAllPaymentIntents();

      expect(mockDb).toHaveBeenCalledWith('payment_intents');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
      expect(result).toEqual(mockPaymentIntents);
    });

    it('should handle custom limit and offset for all payment intents', async () => {
      const limit = 25;
      const offset = 10;
      const mockPaymentIntents: PaymentIntentData[] = [];

      mockQueryBuilder.offset.mockResolvedValueOnce(mockPaymentIntents);

      const result = await model.getAllPaymentIntents(limit, offset);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(limit);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(offset);
      expect(result).toEqual(mockPaymentIntents);
    });

    it('should handle database errors when getting all payment intents', async () => {
      const dbError = new Error('Query failed');
      mockQueryBuilder.offset.mockRejectedValueOnce(dbError);

      await expect(model.getAllPaymentIntents()).rejects.toThrow('Query failed');
      expect(mockLogger.error).toHaveBeenCalledWith(`Error getting all payment intents: ${dbError}`);
    });
  });
});
