import { WebhookEventDbService } from '../webhook_events';
import { WebhookEventData } from '../webhook_events';

// Mock the database module - Knex instance that returns query builders
jest.mock('../../services/database', () => {
  const mockQueryBuilder = {
    insert: jest.fn().mockResolvedValue([1]),
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    first: jest.fn().mockResolvedValue(null),
    orderBy: jest.fn().mockResolvedValue([]),
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

describe('WebhookEventDbService', () => {
  let service: WebhookEventDbService;
  let mockDb: any;
  let mockQueryBuilder: any;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebhookEventDbService();
    
    // Get references to the mocked functions
    mockDb = require('../../services/database').default;
    mockQueryBuilder = mockDb();
    mockLogger = require('../../utils/logger').default;
  });

  describe('createWebhookEvent', () => {
    it('should create a webhook event successfully', async () => {
      const eventData: WebhookEventData = {
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        payment_intent_id: 'pi_123',
        data: { amount: 1000 },
        processed: false,
      };

      await service.createWebhookEvent(eventData);

      // Verify database was called with correct table name
      expect(mockDb).toHaveBeenCalledWith('webhook_events');
      
      // Verify insert was called with correct data
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        id: eventData.id,
        type: eventData.type,
        payment_intent_id: eventData.payment_intent_id,
        data: eventData.data,
        processed: eventData.processed,
        processing_error: undefined,
        received_at: expect.any(Date),
      });

      // Verify logger was called
      expect(mockLogger.info).toHaveBeenCalledWith(`Webhook event created: ${eventData.id}`);
    });

    it('should handle database errors and log them', async () => {
      const eventData: WebhookEventData = {
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: { amount: 1000 },
      };

      const dbError = new Error('Database connection failed');
      mockQueryBuilder.insert.mockRejectedValueOnce(dbError);

      await expect(service.createWebhookEvent(eventData)).rejects.toThrow('Database connection failed');
      
      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(`Error creating webhook event: ${dbError}`);
    });

    it('should create webhook event without payment_intent_id', async () => {
      const eventData: WebhookEventData = {
        id: 'evt_123',
        type: 'customer.created',
        data: { id: 'cus_123' },
        processed: false,
      };

      await service.createWebhookEvent(eventData);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        id: eventData.id,
        type: eventData.type,
        payment_intent_id: undefined,
        data: eventData.data,
        processed: eventData.processed,
        processing_error: undefined,
        received_at: expect.any(Date),
      });
    });
  });

  describe('markWebhookEventAsProcessed', () => {
    it('should mark event as processed successfully', async () => {
      const eventId = 'evt_123';

      await service.markWebhookEventAsProcessed(eventId);

      expect(mockDb).toHaveBeenCalledWith('webhook_events');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id', eventId);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        processed: true,
        processed_at: expect.any(Date),
        processing_error: null,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(`Webhook event marked as processed: ${eventId}`);
    });

    it('should mark event as processed with error message', async () => {
      const eventId = 'evt_123';
      const errorMessage = 'Processing failed';

      await service.markWebhookEventAsProcessed(eventId, errorMessage);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        processed: true,
        processed_at: expect.any(Date),
        processing_error: errorMessage,
      });
    });

    it('should handle database errors when marking as processed', async () => {
      const eventId = 'evt_123';
      const dbError = new Error('Update failed');
      mockQueryBuilder.update.mockRejectedValueOnce(dbError);

      await expect(service.markWebhookEventAsProcessed(eventId)).rejects.toThrow('Update failed');
      expect(mockLogger.error).toHaveBeenCalledWith(`Error marking webhook event as processed: ${dbError}`);
    });
  });

  describe('getWebhookEventById', () => {
    it('should retrieve webhook event by id successfully', async () => {
      const eventId = 'evt_123';
      const mockEvent = {
        id: eventId,
        type: 'payment_intent.succeeded',
        payment_intent_id: 'pi_123',
        data: { amount: 2000, currency: 'usd' },
        processed: false,
        processing_error: null,
        received_at: new Date(),
      };

      mockQueryBuilder.first.mockResolvedValueOnce(mockEvent);

      const result = await service.getWebhookEventById(eventId);

      expect(mockDb).toHaveBeenCalledWith('webhook_events');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id', eventId);
      expect(result).toEqual(mockEvent);
    });

    it('should return null when webhook event not found', async () => {
      const eventId = 'evt_nonexistent';
      mockQueryBuilder.first.mockResolvedValueOnce(null);

      const result = await service.getWebhookEventById(eventId);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id', eventId);
      expect(result).toBeNull();
    });

    it('should handle database errors when getting webhook event', async () => {
      const eventId = 'evt_123';
      const dbError = new Error('Query failed');
      mockQueryBuilder.first.mockRejectedValueOnce(dbError);

      await expect(service.getWebhookEventById(eventId)).rejects.toThrow('Query failed');
      expect(mockLogger.error).toHaveBeenCalledWith(`Error getting webhook event by id: ${dbError}`);
    });
  });

  describe('getUnprocessedEvents', () => {
    it('should retrieve unprocessed events successfully', async () => {
      const mockEvents = [
        {
          id: 'evt_1',
          type: 'payment_intent.succeeded',
          payment_intent_id: 'pi_1',
          data: { amount: 1000, currency: 'usd' },
          processed: false,
          received_at: new Date('2023-01-01'),
        },
        {
          id: 'evt_2',
          type: 'payment_intent.failed',
          payment_intent_id: 'pi_2',
          data: { amount: 2000, currency: 'usd' },
          processed: false,
          received_at: new Date('2023-01-02'),
        },
      ];

      mockQueryBuilder.orderBy.mockResolvedValueOnce(mockEvents);

      const result = await service.getUnprocessedEvents();

      expect(mockDb).toHaveBeenCalledWith('webhook_events');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('processed', false);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('received_at', 'asc');
      expect(result).toEqual(mockEvents);
    });

    it('should return empty array when no unprocessed events exist', async () => {
      mockQueryBuilder.orderBy.mockResolvedValueOnce([]);

      const result = await service.getUnprocessedEvents();

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('processed', false);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('received_at', 'asc');
      expect(result).toEqual([]);
    });

    it('should handle database errors when getting unprocessed events', async () => {
      const dbError = new Error('Query failed');
      mockQueryBuilder.orderBy.mockRejectedValueOnce(dbError);

      await expect(service.getUnprocessedEvents()).rejects.toThrow('Query failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get unprocessed events', {
        error: 'Query failed'
      });
    });
  });
});