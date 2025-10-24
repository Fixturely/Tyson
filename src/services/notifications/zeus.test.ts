import { ZeusNotificationService, ZeusNotificationData } from './zeus';
import logger from '../../utils/logger';
import config from '../../../config';

// Mock logger
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock config
jest.mock('../../../config', () => ({
  __esModule: true,
  default: {
    zeus: {
      webhookUrl: 'http://localhost:8080',
    },
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('ZeusNotificationService', () => {
  let service: ZeusNotificationService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ZeusNotificationService();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  });

  describe('notifyPaymentSucceeded', () => {
    it('should send successful payment notification to Zeus', async () => {
      const notificationData: ZeusNotificationData = {
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        paid_at: new Date('2025-01-24T01:42:25.000Z'),
        metadata: {
          sport_id: 1,
          team_id: 5,
          subscription_type: 'monthly',
        },
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.notifyPaymentSucceeded(notificationData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/subscriptions/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Tyson-Billing-Service/1.0',
          },
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      if (!callArgs || !callArgs[1]) {
        throw new Error('No fetch call made');
      }
      const body = JSON.parse(callArgs[1].body as string);

      expect(body).toMatchObject({
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        status: 'succeeded',
        amount: 5000,
        currency: 'usd',
        paid_at: '2025-01-24T01:42:25.000Z',
        metadata: {
          sport_id: 1,
          team_id: 5,
          subscription_type: 'monthly',
        },
      });
      expect(body.timestamp).toBeDefined();

      expect(logger.info).toHaveBeenCalledWith('Zeus notification sent successfully', {
        subscription_id: 123,
        status: 'succeeded',
        response_status: 200,
      });
    });

    it('should handle Zeus notification errors', async () => {
      const notificationData: ZeusNotificationData = {
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
      };

      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      await expect(service.notifyPaymentSucceeded(notificationData)).rejects.toThrow(
        'Zeus notification failed: 500 Internal Server Error'
      );

      expect(logger.error).toHaveBeenCalledWith('Failed to send Zeus notification', {
        subscription_id: 123,
        error: 'Zeus notification failed: 500 Internal Server Error',
      });
    });

    it('should handle fetch errors', async () => {
      const notificationData: ZeusNotificationData = {
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
      };

      const fetchError = new Error('Network error');
      mockFetch.mockRejectedValue(fetchError);

      await expect(service.notifyPaymentSucceeded(notificationData)).rejects.toThrow('Network error');

      expect(logger.error).toHaveBeenCalledWith('Failed to send Zeus notification', {
        subscription_id: 123,
        error: 'Network error',
      });
    });
  });

  describe('notifyPaymentFailed', () => {
    it('should send failed payment notification to Zeus', async () => {
      const notificationData: ZeusNotificationData = {
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        error_message: 'Card declined',
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.notifyPaymentFailed(notificationData);

      expect(mockFetch).toHaveBeenCalled();

      const callArgs = mockFetch.mock.calls[0];
      if (!callArgs || !callArgs[1]) {
        throw new Error('No fetch call made');
      }
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.status).toBe('failed');
      expect(body.error_message).toBe('Card declined');
    });
  });

  describe('notifyPaymentCanceled', () => {
    it('should send canceled payment notification to Zeus', async () => {
      const notificationData: ZeusNotificationData = {
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        error_message: 'User canceled',
      };

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
      };

      mockFetch.mockResolvedValue(mockResponse as Response);

      await service.notifyPaymentCanceled(notificationData);

      expect(mockFetch).toHaveBeenCalled();

      const callArgs = mockFetch.mock.calls[0];
      if (!callArgs || !callArgs[1]) {
        throw new Error('No fetch call made');
      }
      const body = JSON.parse(callArgs[1].body as string);

      expect(body.status).toBe('canceled');
      expect(body.error_message).toBe('User canceled');
    });
  });

  describe('without Zeus webhook URL configured', () => {
    it('should log notification when webhook URL is not configured', async () => {
      // Clear mocks
      jest.clearAllMocks();
      
      // Temporarily override config
      const originalConfig = config.zeus?.webhookUrl;
      (config as any).zeus.webhookUrl = '';

      const serviceWithoutUrl = new ZeusNotificationService();
      
      const notificationData: ZeusNotificationData = {
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
      };

      await serviceWithoutUrl.notifyPaymentSucceeded(notificationData);

      // Should log to console instead of making HTTP request
      expect(logger.info).toHaveBeenCalledWith(
        'Zeus notification (webhook URL not configured)',
        expect.objectContaining({
          subscription_id: 123,
          status: 'succeeded',
        })
      );

      // Should NOT make fetch call
      expect(mockFetch).not.toHaveBeenCalled();

      // Restore original config
      (config as any).zeus.webhookUrl = originalConfig;
    });
  });

});
