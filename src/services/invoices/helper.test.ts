import Stripe from 'stripe';
import {
  extractPaymentIntentIdFromInvoice,
  buildNotificationDataFromInvoice,
} from './helper';
import type { ZeusSubscriptionData } from '../../models/zeus_subscriptions';

// Mock database to prevent knex initialization
jest.mock('../../services/database', () => ({
  default: {},
}));

// Mock payments helper
jest.mock('../payments/helper', () => ({
  buildMetadata: jest.fn((sub: any) => {
    const metadata: any = {};
    if (sub.sport_id) metadata.sport_id = sub.sport_id;
    if (sub.team_id) metadata.team_id = sub.team_id;
    if (sub.subscription_type)
      metadata.subscription_type = sub.subscription_type;
    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }),
  ZeusSubscription: {},
}));

describe('Invoices Helper Functions', () => {
  describe('extractPaymentIntentIdFromInvoice', () => {
    it('should extract payment intent ID when payment_intent is a string', () => {
      const invoice = {
        payment_intent: 'pi_test_123',
      } as Stripe.Invoice;

      expect(extractPaymentIntentIdFromInvoice(invoice)).toBe('pi_test_123');
    });

    it('should extract payment intent ID when payment_intent is an object', () => {
      const invoice = {
        payment_intent: {
          id: 'pi_test_456',
        },
      } as Stripe.Invoice;

      expect(extractPaymentIntentIdFromInvoice(invoice)).toBe('pi_test_456');
    });

    it('should return undefined when payment_intent is null', () => {
      const invoice = {
        payment_intent: null,
      } as Stripe.Invoice;

      expect(extractPaymentIntentIdFromInvoice(invoice)).toBeUndefined();
    });

    it('should return undefined when payment_intent is undefined', () => {
      const invoice = {} as Stripe.Invoice;

      expect(extractPaymentIntentIdFromInvoice(invoice)).toBeUndefined();
    });
  });

  describe('buildNotificationDataFromInvoice', () => {
    it('should build notification data with all fields', () => {
      const invoice = {
        id: 'in_test_123',
        amount_paid: 2000,
        currency: 'usd',
        payment_intent: 'pi_test_123',
        status: 'paid',
        status_transitions: {
          paid_at: 1234567890,
        },
      } as unknown as Stripe.Invoice;

      const subscription: ZeusSubscriptionData = {
        subscription_id: 789,
        user_id: 101,
        payment_intent_id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        sport_id: 1,
        team_id: 42,
        subscription_type: 'premium',
        customer_email: 'test@example.com',
      };

      const result = buildNotificationDataFromInvoice(invoice, subscription);

      expect(result).toEqual({
        subscription_id: 789,
        user_id: 101,
        payment_intent_id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        metadata: {
          sport_id: 1,
          team_id: 42,
          subscription_type: 'premium',
        },
        paid_at: new Date(1234567890 * 1000),
      });
    });

    it('should use amount_due when amount_paid is not available', () => {
      const invoice = {
        amount_due: 1500,
        currency: 'usd',
        payment_intent: 'pi_test_123',
      } as unknown as Stripe.Invoice;

      const subscription: ZeusSubscriptionData = {
        subscription_id: 789,
        user_id: 101,
        payment_intent_id: 'pi_test_123',
        amount: 1500,
        currency: 'usd',
        status: 'pending',
        customer_email: 'test@example.com',
      };

      const result = buildNotificationDataFromInvoice(invoice, subscription);

      expect(result.amount).toBe(1500);
    });

    it('should use subscription currency when invoice currency not available', () => {
      const invoice = {
        payment_intent: 'pi_test_123',
      } as unknown as Stripe.Invoice;

      const subscription: ZeusSubscriptionData = {
        subscription_id: 789,
        user_id: 101,
        payment_intent_id: 'pi_test_123',
        amount: 2000,
        currency: 'eur',
        status: 'pending',
        customer_email: 'test@example.com',
      };

      const result = buildNotificationDataFromInvoice(invoice, subscription);

      expect(result.currency).toBe('eur');
    });

    it('should handle payment_intent as object', () => {
      const invoice = {
        payment_intent: {
          id: 'pi_object_test',
        },
        amount_paid: 2000,
        currency: 'usd',
      } as unknown as Stripe.Invoice;

      const subscription: ZeusSubscriptionData = {
        subscription_id: 789,
        user_id: 101,
        payment_intent_id: 'pi_object_test',
        amount: 2000,
        currency: 'usd',
        status: 'pending',
        customer_email: 'test@example.com',
      };

      const result = buildNotificationDataFromInvoice(invoice, subscription);

      expect(result.payment_intent_id).toBe('pi_object_test');
    });

    it('should not include paid_at when status is not paid', () => {
      const invoice = {
        payment_intent: 'pi_test_123',
        status: 'open',
      } as unknown as Stripe.Invoice;

      const subscription: ZeusSubscriptionData = {
        subscription_id: 789,
        user_id: 101,
        payment_intent_id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'pending',
        customer_email: 'test@example.com',
      };

      const result = buildNotificationDataFromInvoice(invoice, subscription);

      expect(result.paid_at).toBeUndefined();
    });

    it('should handle empty metadata', () => {
      const invoice = {
        payment_intent: 'pi_test_123',
        amount_paid: 2000,
        currency: 'usd',
      } as unknown as Stripe.Invoice;

      const subscription: ZeusSubscriptionData = {
        subscription_id: 789,
        user_id: 101,
        payment_intent_id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'pending',
        customer_email: 'test@example.com',
      };

      const result = buildNotificationDataFromInvoice(invoice, subscription);

      expect(result.metadata).toEqual({});
    });
  });
});
