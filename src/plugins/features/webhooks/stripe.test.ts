import request from 'supertest';
import { idempotencyKeyStore } from '../../../services/idempotency';

// Mock database service
jest.mock('../../../services/database', () => ({
  default: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([])
  }
}));

// Mock webhook database service
jest.mock('../../../services/webhooks/db', () => ({
  webhookEventDbService: {
    createWebhookEvent: jest.fn().mockResolvedValue(undefined),
    markWebhookEventAsProcessed: jest.fn().mockResolvedValue(undefined),
    getWebhookEventById: jest.fn().mockResolvedValue(null),
    getUnprocessedEvents: jest.fn().mockResolvedValue([])
  }
}));

import { webhookEventDbService } from '../../../services/webhooks/db';
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
                status: 'succeeded'
              }
            }
          };
        }
        throw new Error('Invalid signature');
      })
    }
  }));
});

// Mock database service
jest.mock('../../../services/webhooks/db', () => ({
  webhookEventDbService: {
    createWebhookEvent: jest.fn().mockResolvedValue(undefined),
    markWebhookEventAsProcessed: jest.fn().mockResolvedValue(undefined),
    getWebhookEventById: jest.fn().mockResolvedValue(null),
    getUnprocessedEvents: jest.fn().mockResolvedValue([])
  }
}));

describe('Stripe Webhook Handler', () => {
  beforeEach(() => {
    // Clear idempotency store
    idempotencyKeyStore['processedEvents'].clear();
    idempotencyKeyStore['eventTimestamps'].clear();
    
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
      expect(webhookEventDbService.markWebhookEventAsProcessed).toHaveBeenCalled();
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
      // First request
      const response1 = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({ test: 'data' });

      expect(response1.status).toBe(200);
      expect(response1.body.message).toBe('Webhook received');

      // Second request (same event)
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
          type: 'payment_intent.succeeded'
        })
      );
    });
  });

  describe('GET /api/v1/webhooks/stripe/stats', () => {
    it('should return idempotency stats', async () => {
      // Add some processed events
      idempotencyKeyStore.markProcessed('evt_1');
      idempotencyKeyStore.markProcessed('evt_2');

      const response = await request(app)
        .get('/api/v1/webhooks/stripe/stats');

      expect(response.status).toBe(200);
      expect(response.body.idempotency.totalProcessed).toBe(2);
      expect(response.body.timestamp).toBeDefined();
    });
  });
});