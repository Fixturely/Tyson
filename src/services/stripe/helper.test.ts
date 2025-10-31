import Stripe from 'stripe';

// Mock database to prevent knex initialization
jest.mock('../../services/database', () => ({
  default: {},
}));

// Mock payments helper since it imports models
jest.mock('../payments/helper', () => ({
  extractCustomerId: jest.fn((pi: Stripe.PaymentIntent) => {
    return pi.customer
      ? typeof pi.customer === 'string'
        ? pi.customer
        : pi.customer.id
      : undefined;
  }),
  extractPaymentMethodId: jest.fn((pi: Stripe.PaymentIntent) => {
    return pi.payment_method
      ? typeof pi.payment_method === 'string'
        ? pi.payment_method
        : (pi.payment_method as Stripe.PaymentMethod).id
      : undefined;
  }),
}));

import { mapPaymentIntentToResult } from './helper';

describe('Stripe Helper Functions', () => {
  describe('mapPaymentIntentToResult', () => {
    it('should map all required fields', () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        created: 1234567890,
        client_secret: 'pi_test_123_secret',
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      const result = mapPaymentIntentToResult(pi);

      expect(result).toEqual({
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        created: 1234567890,
        client_secret: 'pi_test_123_secret',
        customer: null,
        description: null,
        metadata: null,
        payment_method: null,
      });
    });

    it('should map optional fields when customer is a string', () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        client_secret: 'pi_test_123_secret',
        customer: 'cus_test_123',
        description: 'Test payment',
        metadata: { order_id: 'order_123' },
        payment_method: 'pm_test_123',
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      const result = mapPaymentIntentToResult(pi);

      expect(result.customer).toBe('cus_test_123');
      expect(result.description).toBe('Test payment');
      expect(result.metadata).toEqual({ order_id: 'order_123' });
      expect(result.payment_method).toBe('pm_test_123');
    });

    it('should map customer when customer is an object', () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        client_secret: 'pi_test_123_secret',
        customer: {
          id: 'cus_object_test',
        },
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      const result = mapPaymentIntentToResult(pi);

      expect(result.customer).toBe('cus_object_test');
    });

    it('should map payment_method when payment_method is an object', () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        client_secret: 'pi_test_123_secret',
        payment_method: {
          id: 'pm_object_test',
        } as Stripe.PaymentMethod,
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      const result = mapPaymentIntentToResult(pi);

      expect(result.payment_method).toBe('pm_object_test');
    });

    it('should use null for missing optional fields', () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        client_secret: 'pi_test_123_secret',
        customer: null,
        description: null,
        metadata: null,
        payment_method: null,
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      const result = mapPaymentIntentToResult(pi);

      expect(result.customer).toBeNull();
      expect(result.description).toBeNull();
      expect(result.metadata).toBeNull();
      expect(result.payment_method).toBeNull();
    });

    it('should handle undefined optional fields as null', () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        client_secret: 'pi_test_123_secret',
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      const result = mapPaymentIntentToResult(pi);

      expect(result.customer).toBeNull();
      expect(result.description).toBeNull();
      expect(result.metadata).toBeNull();
      expect(result.payment_method).toBeNull();
    });
  });
});

