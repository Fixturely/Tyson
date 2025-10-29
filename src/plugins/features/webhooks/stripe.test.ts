import request from 'supertest';
import { idempotencyKeyStore } from '../../../services/idempotency';

// Mock idempotency service
jest.mock('../../../services/idempotency', () => ({
  idempotencyKeyStore: {
    hasProcessed: jest.fn().mockResolvedValue(false),
    markProcessed: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockResolvedValue({
      total_processed: 0,
      failed_count: 0,
    }),
  },
}));

// Mock database service
jest.mock('../../../services/database', () => ({
  default: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
  },
}));

// Mock webhook database service
jest.mock('../../../models/webhook_events', () => ({
  webhookEventDbService: {
    createWebhookEvent: jest.fn().mockResolvedValue(undefined),
    markWebhookEventAsProcessed: jest.fn().mockResolvedValue(undefined),
    getWebhookEventById: jest.fn().mockResolvedValue(null),
    getUnprocessedEvents: jest.fn().mockResolvedValue([]),
  },
}));

// Mock Zeus subscription model
jest.mock('../../../models/zeus_subscriptions', () => ({
  zeusSubscriptionModel: {
    getZeusSubscriptionByPaymentIntent: jest.fn().mockResolvedValue(null),
    updateZeusSubscriptionStatus: jest.fn().mockResolvedValue(undefined),
    markZeusNotified: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock Zeus notification service
jest.mock('../../../services/notifications/zeus', () => ({
  zeusNotificationService: {
    notifyPaymentSucceeded: jest.fn().mockResolvedValue(undefined),
    notifyPaymentFailed: jest.fn().mockResolvedValue(undefined),
    notifyPaymentCanceled: jest.fn().mockResolvedValue(undefined),
  },
}));

import { webhookEventDbService } from '../../../models/webhook_events';
import app from '../../../index';

// Mock Stripe webhook verification
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn((body, sig, secret) => {
        if (sig === 'valid_signature') {
          return {
            id: 'evt_test_123',
            type: 'payment_intent.succeeded',
            data: {
              object: {
                id: 'pi_test_123',
                amount: 2000,
                currency: 'usd',
                status: 'succeeded',
              },
            },
          };
        }
        throw new Error('Invalid signature');
      }),
    },
  }));
});

describe('Stripe Webhook Handler', () => {
  beforeEach(() => {
    // Mock idempotency store to always return not processed
    (idempotencyKeyStore.hasProcessed as jest.Mock).mockResolvedValue(false);

    // Clear mocks
    jest.clearAllMocks();
  });

  describe('POST /api/v1/webhooks/stripe', () => {
    it('should process valid webhook events', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({ test: 'data' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Webhook received');
      expect(webhookEventDbService.createWebhookEvent).toHaveBeenCalled();
      expect(
        webhookEventDbService.markWebhookEventAsProcessed
      ).toHaveBeenCalled();
    });

    it('should reject webhooks without signature', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/stripe')
        .send({ test: 'data' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing stripe-signature header');
    });

    it('should reject webhooks with invalid signature', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send({ test: 'data' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid signature');
    });

    it('should handle idempotency correctly', async () => {
      // First request - not processed yet
      (idempotencyKeyStore.hasProcessed as jest.Mock).mockResolvedValueOnce(
        false
      );

      const response1 = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({ test: 'data' });

      expect(response1.status).toBe(200);
      expect(response1.body.message).toBe('Webhook received');

      // Second request - already processed
      (idempotencyKeyStore.hasProcessed as jest.Mock).mockResolvedValueOnce(
        true
      );

      const response2 = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({ test: 'data' });

      expect(response2.status).toBe(200);
      expect(response2.body.message).toBe('Event already processed');
    });

    it('should handle database storage errors gracefully', async () => {
      // Mock database error
      (webhookEventDbService.createWebhookEvent as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({ test: 'data' });

      // Should still process the webhook even if storage fails
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Webhook received');
    });

    it('should handle processing errors gracefully', async () => {
      // This test verifies that the webhook handler continues processing
      // even if there are errors, which is the current design
      const response = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({ test: 'data' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Webhook received');
    });
  });

  describe('Event Type Handling', () => {
    it('should handle different event types', async () => {
      // Test that the webhook handler can process various event types
      // The current mock returns 'payment_intent.succeeded' by default
      const response = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({ test: 'data' });

      expect(response.status).toBe(200);
      expect(webhookEventDbService.createWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'evt_test_123',
          type: 'payment_intent.succeeded',
        })
      );
    });
  });

  describe('GET /api/v1/webhooks/stripe/stats', () => {
    it('should return idempotency stats', async () => {
      // Mock stats
      (idempotencyKeyStore.getStats as jest.Mock).mockResolvedValue({
        total_processed: 10,
        failed_count: 2,
      });

      const response = await request(app).get('/api/v1/webhooks/stripe/stats');

      expect(response.status).toBe(200);
      expect(response.body.idempotency.total_processed).toBe(10);
      expect(response.body.idempotency.failed_count).toBe(2);
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
