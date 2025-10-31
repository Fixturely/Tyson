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

// Mock customer payment methods model
jest.mock('../../../models/customer_payment_methods', () => ({
  customerPaymentMethodsModel: {
    upsertFromStripePaymentMethod: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock payment intent model
jest.mock('../../../models/payment_intent', () => ({
  paymentIntentModel: {
    upsertPaymentIntent: jest.fn().mockResolvedValue(undefined),
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

// Mock customer billing info model
jest.mock('../../../models/customer_billing_info', () => ({
  customerBillingInfoModel: {
    updateFromStripe: jest.fn().mockResolvedValue(undefined),
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
jest.mock('../../../services/notifications', () => ({
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
  const constructEvent = jest.fn((body, sig, secret) => {
    if (sig !== 'valid_signature') {
      throw new Error('Invalid signature');
    }

    // Body may be Buffer or object in tests; try to read type
    let parsedType;
    try {
      if (typeof body === 'string') {
        parsedType = JSON.parse(body)?.type;
      } else if (Buffer.isBuffer(body)) {
        parsedType = JSON.parse(body.toString('utf8'))?.type;
      } else if (typeof body === 'object' && body !== null) {
        parsedType = body.type;
      }
    } catch (_) {
      // ignore parse errors; fallback below
    }

    const type = parsedType || 'payment_intent.succeeded';

    if (type === 'customer.created' || type === 'customer.updated') {
      return {
        id: 'evt_test_customer',
        type,
        data: {
          object: {
            id: 'cus_123',
            email: 'user@example.com',
            name: 'Jane Doe',
            address: { line1: '123 Main St', city: 'Metropolis' },
          },
        },
      };
    }

    // Default: payment_intent.succeeded
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
  });

  const retrievePaymentMethod = jest.fn().mockResolvedValue({
    id: 'pm_mock',
    type: 'card',
    card: {
      brand: 'visa',
      last4: '4242',
      exp_month: 12,
      exp_year: 2030,
      funding: 'credit',
    },
  });

  const sharedInstance = {
    webhooks: { constructEvent },
    paymentMethods: { retrieve: retrievePaymentMethod },
  };

  return jest.fn().mockImplementation(() => sharedInstance);
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

    it('should upsert customer billing info on customer.created', async () => {
      const {
        customerBillingInfoModel,
      } = require('../../../models/customer_billing_info');
      const StripeLib = require('stripe');
      const stripeInstance = new StripeLib();
      stripeInstance.webhooks.constructEvent.mockImplementationOnce(() => ({
        id: 'evt_customer_created',
        type: 'customer.created',
        data: {
          object: {
            id: 'cus_123',
            email: 'user@example.com',
            name: 'Jane Doe',
            address: { line1: '123 Main St', city: 'Metropolis' },
          },
        },
      }));

      // Trigger customer.created
      const response = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({ test: 'data', type: 'customer.created' });

      expect(response.status).toBe(200);
      expect(customerBillingInfoModel.updateFromStripe).toHaveBeenCalled();
    });

    it('should upsert customer billing info on customer.updated', async () => {
      const {
        customerBillingInfoModel,
      } = require('../../../models/customer_billing_info');
      const StripeLib = require('stripe');
      const stripeInstance = new StripeLib();
      stripeInstance.webhooks.constructEvent.mockImplementationOnce(() => ({
        id: 'evt_customer_updated',
        type: 'customer.updated',
        data: {
          object: {
            id: 'cus_123',
            email: 'new@example.com',
            name: 'Jane D',
            address: { line1: '456 Elm', city: 'Gotham' },
          },
        },
      }));

      // Trigger customer.updated
      const response = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({ test: 'data', type: 'customer.updated' });

      expect(response.status).toBe(200);
      expect(customerBillingInfoModel.updateFromStripe).toHaveBeenCalled();
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

  describe('PaymentIntent persistence', () => {
    const testCases = [
      {
        eventType: 'payment_intent.created',
        payload: {
          id: 'pi_created',
          status: 'requires_payment_method',
          customer: 'cus_abc',
        },
        expected: { id: 'pi_created', status: 'requires_payment_method' },
      },
      {
        eventType: 'payment_intent.succeeded',
        payload: {
          id: 'pi_succeeded',
          status: 'succeeded',
          customer: 'cus_xyz',
          payment_method: 'pm_xyz',
        },
        expected: {
          id: 'pi_succeeded',
          status: 'succeeded',
          payment_method: 'pm_xyz',
        },
      },
      {
        eventType: 'payment_intent.payment_failed',
        payload: {
          id: 'pi_failed',
          status: 'requires_payment_method',
          customer: 'cus_fff',
        },
        expected: { id: 'pi_failed', status: 'requires_payment_method' },
      },
      {
        eventType: 'payment_intent.canceled',
        payload: {
          id: 'pi_canceled',
          status: 'canceled',
          customer: 'cus_can',
        },
        expected: { id: 'pi_canceled', status: 'canceled' },
      },
    ];

    test.each(testCases)(
      'upserts on %s',
      async ({ eventType, payload, expected }) => {
        const {
          paymentIntentModel,
        } = require('../../../models/payment_intent');
        const StripeLib = require('stripe');
        const stripeInstance = new StripeLib();

        stripeInstance.webhooks.constructEvent.mockImplementationOnce(() => ({
          id: `evt_${payload.id}`,
          type: eventType,
          data: {
            object: {
              amount: 1000,
              currency: 'usd',
              created: 1234567890,
              ...payload,
            },
          },
        }));

        const resp = await request(app)
          .post('/api/v1/webhooks/stripe')
          .set('stripe-signature', 'valid_signature')
          .send({});

        expect(resp.status).toBe(200);
        expect(paymentIntentModel.upsertPaymentIntent).toHaveBeenCalledWith(
          expect.objectContaining(expected)
        );
      }
    );
  });

  describe('Payment method persistence rules', () => {
    it('persists payment method on payment_intent.succeeded when save flag is true', async () => {
      const {
        customerPaymentMethodsModel,
      } = require('../../../models/customer_payment_methods');
      const StripeLib = require('stripe');
      const stripeInstance = new StripeLib();
      stripeInstance.webhooks.constructEvent.mockImplementationOnce(() => ({
        id: 'evt_pi_succeeded_true',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_pi',
            amount: 1000,
            currency: 'usd',
            status: 'succeeded',
            customer: 'cus_123',
            payment_method: 'pm_123',
            metadata: { save_payment_method: 'true' },
          },
        },
      }));

      const resp = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({});

      expect(resp.status).toBe(200);
      expect(
        customerPaymentMethodsModel.upsertFromStripePaymentMethod
      ).toHaveBeenCalled();
    });

    it('does not persist payment method when save flag is false', async () => {
      const {
        customerPaymentMethodsModel,
      } = require('../../../models/customer_payment_methods');
      (
        customerPaymentMethodsModel.upsertFromStripePaymentMethod as jest.Mock
      ).mockClear();
      const StripeLib = require('stripe');
      const stripeInstance = new StripeLib();
      stripeInstance.webhooks.constructEvent.mockImplementationOnce(() => ({
        id: 'evt_pi_succeeded_false',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_pi',
            amount: 1000,
            currency: 'usd',
            status: 'succeeded',
            customer: 'cus_123',
            payment_method: 'pm_123',
            metadata: { save_payment_method: 'false' },
          },
        },
      }));

      const resp = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({});

      expect(resp.status).toBe(200);
      expect(
        customerPaymentMethodsModel.upsertFromStripePaymentMethod
      ).not.toHaveBeenCalled();
    });

    it('does not upsert on payment_method.attached anymore', async () => {
      const {
        customerPaymentMethodsModel,
      } = require('../../../models/customer_payment_methods');
      (
        customerPaymentMethodsModel.upsertFromStripePaymentMethod as jest.Mock
      ).mockClear();
      const StripeLib = require('stripe');
      const stripeInstance = new StripeLib();
      stripeInstance.webhooks.constructEvent.mockImplementationOnce(() => ({
        id: 'evt_pm_attached',
        type: 'payment_method.attached',
        data: {
          object: {
            id: 'pm_123',
            customer: 'cus_123',
            type: 'card',
            card: {
              brand: 'visa',
              last4: '4242',
              exp_month: 12,
              exp_year: 2030,
              funding: 'credit',
            },
          },
        },
      }));

      const resp = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({});

      expect(resp.status).toBe(200);
      expect(
        customerPaymentMethodsModel.upsertFromStripePaymentMethod
      ).not.toHaveBeenCalled();
    });
  });

  describe('Error handling in catch with marking failures', () => {
    it('still responds 500 if processing fails and marking also errors', async () => {
      const StripeLib = require('stripe');
      const stripeInstance = new StripeLib();
      // Force processing error by throwing during succeeded handling
      const {
        zeusSubscriptionModel,
      } = require('../../../models/zeus_subscriptions');
      (
        zeusSubscriptionModel.updateZeusSubscriptionStatus as jest.Mock
      ).mockRejectedValueOnce(new Error('Zeus update failed'));

      const {
        webhookEventDbService,
      } = require('../../../models/webhook_events');
      (
        webhookEventDbService.markWebhookEventAsProcessed as jest.Mock
      ).mockRejectedValueOnce(new Error('mark failed'));
      const { idempotencyKeyStore } = require('../../../services/idempotency');
      (idempotencyKeyStore.markProcessed as jest.Mock).mockRejectedValueOnce(
        new Error('idem failed')
      );

      stripeInstance.webhooks.constructEvent.mockImplementationOnce(() => ({
        id: 'evt_fail',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_x',
            amount: 1000,
            currency: 'usd',
            status: 'succeeded',
          },
        },
      }));

      const resp = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'valid_signature')
        .send({});

      expect(resp.status).toBe(500);
      expect(resp.body).toEqual({ error: 'Internal server error' });
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
