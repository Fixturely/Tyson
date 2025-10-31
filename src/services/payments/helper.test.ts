import Stripe from 'stripe';
import {
  extractCustomerId,
  extractPaymentMethodId,
  mapStripePIToModel,
  buildMetadata,
  handleZeusSubscription,
  ZeusSubscription,
} from './helper';
import { zeusSubscriptionModel } from '../../models/zeus_subscriptions';
import { zeusNotificationService } from '../notifications';

// Mock database to prevent knex initialization
jest.mock('../../services/database', () => ({
  default: {},
}));

// Mock dependencies
jest.mock('../../models/zeus_subscriptions');
jest.mock('../notifications');
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Payments Helper Functions', () => {
  describe('extractCustomerId', () => {
    it('should extract customer ID when customer is a string', () => {
      const pi = {
        customer: 'cus_test_123',
      } as Stripe.PaymentIntent;

      expect(extractCustomerId(pi)).toBe('cus_test_123');
    });

    it('should extract customer ID when customer is an object', () => {
      const pi = {
        customer: {
          id: 'cus_test_456',
        },
      } as Stripe.PaymentIntent;

      expect(extractCustomerId(pi)).toBe('cus_test_456');
    });

    it('should return undefined when customer is null', () => {
      const pi = {
        customer: null,
      } as Stripe.PaymentIntent;

      expect(extractCustomerId(pi)).toBeUndefined();
    });

    it('should return undefined when customer is undefined', () => {
      const pi = {} as Stripe.PaymentIntent;

      expect(extractCustomerId(pi)).toBeUndefined();
    });
  });

  describe('extractPaymentMethodId', () => {
    it('should extract payment method ID when payment_method is a string', () => {
      const pi = {
        payment_method: 'pm_test_123',
      } as Stripe.PaymentIntent;

      expect(extractPaymentMethodId(pi)).toBe('pm_test_123');
    });

    it('should extract payment method ID when payment_method is an object', () => {
      const pi = {
        payment_method: {
          id: 'pm_test_456',
        } as Stripe.PaymentMethod,
      } as Stripe.PaymentIntent;

      expect(extractPaymentMethodId(pi)).toBe('pm_test_456');
    });

    it('should return undefined when payment_method is null', () => {
      const pi = {
        payment_method: null,
      } as Stripe.PaymentIntent;

      expect(extractPaymentMethodId(pi)).toBeUndefined();
    });

    it('should return undefined when payment_method is undefined', () => {
      const pi = {} as Stripe.PaymentIntent;

      expect(extractPaymentMethodId(pi)).toBeUndefined();
    });
  });

  describe('mapStripePIToModel', () => {
    it('should map all required fields', () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        created: 1234567890,
      } as Stripe.PaymentIntent;

      const result = mapStripePIToModel(pi);

      expect(result).toEqual({
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        created: 1234567890,
      });
    });

    it('should map optional fields when present', () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        customer: 'cus_test',
        description: 'Test payment',
        metadata: { order_id: 'order_123' },
        payment_method: 'pm_test',
        client_secret: 'pi_test_secret_123',
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      const result = mapStripePIToModel(pi);

      expect(result).toEqual({
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        customer_id: 'cus_test',
        description: 'Test payment',
        metadata: { order_id: 'order_123' },
        payment_method: 'pm_test',
        client_secret: 'pi_test_secret_123',
      });
    });

    it('should handle customer as object', () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        customer: {
          id: 'cus_object_test',
        },
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      const result = mapStripePIToModel(pi);

      expect(result.customer_id).toBe('cus_object_test');
    });

    it('should handle payment_method as object', () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        payment_method: {
          id: 'pm_object_test',
        } as Stripe.PaymentMethod,
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      const result = mapStripePIToModel(pi);

      expect(result.payment_method).toBe('pm_object_test');
    });

    it('should not include optional fields when null or undefined', () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        customer: null,
        description: null,
        metadata: null,
        payment_method: null,
        client_secret: null,
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      const result = mapStripePIToModel(pi);

      expect(result.customer_id).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.metadata).toBeUndefined();
      expect(result.payment_method).toBeUndefined();
      expect(result.client_secret).toBeUndefined();
    });
  });

  describe('buildMetadata', () => {
    it('should build metadata with all fields', () => {
      const subscription: ZeusSubscription = {
        sport_id: 1,
        team_id: 42,
        subscription_type: 'premium',
      };

      const result = buildMetadata(subscription);

      expect(result).toEqual({
        sport_id: 1,
        team_id: 42,
        subscription_type: 'premium',
      });
    });

    it('should build metadata with partial fields', () => {
      const subscription: ZeusSubscription = {
        sport_id: 1,
      };

      const result = buildMetadata(subscription);

      expect(result).toEqual({
        sport_id: 1,
      });
    });

    it('should return undefined when no metadata fields are present', () => {
      const subscription: ZeusSubscription = {};

      const result = buildMetadata(subscription);

      expect(result).toBeUndefined();
    });

    it('should return undefined when all fields are undefined', () => {
      const subscription: ZeusSubscription = {};

      const result = buildMetadata(subscription);

      expect(result).toBeUndefined();
    });

    it('should handle zero values', () => {
      const subscription: ZeusSubscription = {
        sport_id: 0,
        team_id: 0,
      };

      // Zero values are now included (using != null check)
      const result = buildMetadata(subscription);

      expect(result).toEqual({
        sport_id: 0,
        team_id: 0,
      });
    });
  });

  describe('handleZeusSubscription', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return early when no subscription found', async () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
      } as Stripe.PaymentIntent;

      (zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(null);

      await handleZeusSubscription(pi, 'succeeded');

      expect(
        zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent
      ).toHaveBeenCalledWith('pi_test_123');
      expect(
        zeusSubscriptionModel.updateZeusSubscriptionStatus
      ).not.toHaveBeenCalled();
    });

    it('should update subscription and notify on success', async () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
      } as Stripe.PaymentIntent;

      const subscription = {
        subscription_id: 789,
        user_id: 101,
        sport_id: 1,
        team_id: 42,
      };

      (zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(subscription);
      (zeusSubscriptionModel.updateZeusSubscriptionStatus as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);
      (zeusNotificationService.notifyPaymentSucceeded as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);
      (zeusSubscriptionModel.markZeusNotified as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);

      const paidAt = new Date();
      await handleZeusSubscription(pi, 'succeeded', paidAt);

      expect(
        zeusSubscriptionModel.updateZeusSubscriptionStatus
      ).toHaveBeenCalledWith(789, 'succeeded', paidAt);
      expect(zeusNotificationService.notifyPaymentSucceeded).toHaveBeenCalled();
      expect(zeusSubscriptionModel.markZeusNotified).toHaveBeenCalledWith(789);
    });

    it('should handle failed payment with error message', async () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        last_payment_error: {
          message: 'Card declined',
        },
      } as Stripe.PaymentIntent;

      const subscription = {
        subscription_id: 789,
        user_id: 101,
      };

      (zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(subscription);
      (zeusSubscriptionModel.updateZeusSubscriptionStatus as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);
      (zeusNotificationService.notifyPaymentFailed as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);

      await handleZeusSubscription(pi, 'failed');

      expect(zeusNotificationService.notifyPaymentFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: 'Card declined',
        })
      );
    });

    it('should handle failed payment without error message', async () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
      } as Stripe.PaymentIntent;

      const subscription = {
        subscription_id: 789,
        user_id: 101,
      };

      (zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(subscription);
      (zeusSubscriptionModel.updateZeusSubscriptionStatus as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);
      (zeusNotificationService.notifyPaymentFailed as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);

      await handleZeusSubscription(pi, 'failed');

      expect(zeusNotificationService.notifyPaymentFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: 'Unknown failure reason',
        })
      );
    });

    it('should handle canceled payment with cancellation reason', async () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        cancellation_reason: 'duplicate',
      } as Stripe.PaymentIntent;

      const subscription = {
        subscription_id: 789,
        user_id: 101,
      };

      (zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(subscription);
      (zeusSubscriptionModel.updateZeusSubscriptionStatus as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);
      (zeusNotificationService.notifyPaymentCanceled as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);

      await handleZeusSubscription(pi, 'canceled');

      expect(
        zeusNotificationService.notifyPaymentCanceled
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: 'duplicate',
        })
      );
    });

    it('should handle notification errors gracefully', async () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
      } as Stripe.PaymentIntent;

      const subscription = {
        subscription_id: 789,
        user_id: 101,
      };

      (zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(subscription);
      (zeusSubscriptionModel.updateZeusSubscriptionStatus as jest.Mock) = jest
        .fn()
        .mockResolvedValue(undefined);
      (zeusNotificationService.notifyPaymentSucceeded as jest.Mock) = jest
        .fn()
        .mockRejectedValue(new Error('Notification failed'));

      // Should not throw - errors are logged but don't propagate
      await handleZeusSubscription(pi, 'succeeded');

      // Verify notification was attempted
      expect(zeusNotificationService.notifyPaymentSucceeded).toHaveBeenCalled();
    });
  });
});
