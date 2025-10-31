import Stripe from 'stripe';
import { PaymentsService, PaymentsServiceDependencies } from './controller';
import { paymentIntentModel } from '../../models/payment_intent';
import { customerPaymentMethodsModel } from '../../models/customer_payment_methods';
import { zeusSubscriptionModel } from '../../models/zeus_subscriptions';
import { zeusNotificationService } from '../notifications';

// Mock database to prevent knex initialization
jest.mock('../../services/database', () => ({
  default: {},
}));

// Mock dependencies
jest.mock('../../models/payment_intent');
jest.mock('../../models/customer_payment_methods');
jest.mock('../../models/zeus_subscriptions');
jest.mock('../notifications');

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockDeps: PaymentsServiceDependencies;
  let mockStripe: jest.Mocked<Stripe>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStripe = {
      paymentMethods: {
        retrieve: jest.fn(),
      },
    } as any;

    mockDeps = {
      stripe: mockStripe,
      paymentIntentModel: paymentIntentModel as any,
      customerPaymentMethodsModel: customerPaymentMethodsModel as any,
      zeusSubscriptionModel: zeusSubscriptionModel as any,
      zeusNotificationService: zeusNotificationService as any,
    };

    service = new PaymentsService(mockDeps);
  });

  describe('handlePaymentIntentCreated', () => {
    it('should upsert payment intent to database', async () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        created: 1234567890,
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      (mockDeps.paymentIntentModel.upsertPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(undefined);

      await service.handlePaymentIntentCreated(pi);

      expect(
        mockDeps.paymentIntentModel.upsertPaymentIntent
      ).toHaveBeenCalledTimes(1);
      expect(
        mockDeps.paymentIntentModel.upsertPaymentIntent
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pi_test_123',
          amount: 2000,
          currency: 'usd',
          status: 'requires_payment_method',
        })
      );
    });
  });

  describe('handlePaymentIntentSucceeded', () => {
    it('should upsert payment intent and handle Zeus subscription', async () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        customer: 'cus_test',
        payment_method: 'pm_test',
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      (mockDeps.paymentIntentModel.upsertPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(undefined);
      (mockDeps.zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(null);

      await service.handlePaymentIntentSucceeded(pi);

      expect(
        mockDeps.paymentIntentModel.upsertPaymentIntent
      ).toHaveBeenCalledTimes(1);
    });

    it('should save payment method when metadata flag is set', async () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        customer: 'cus_test',
        payment_method: 'pm_test',
        metadata: { save_payment_method: 'true' },
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      const mockPaymentMethod = {
        id: 'pm_test',
        type: 'card',
        card: { brand: 'visa', last4: '4242' },
      } as Stripe.PaymentMethod;

      (mockDeps.paymentIntentModel.upsertPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(undefined);
      (mockStripe.paymentMethods.retrieve as jest.Mock).mockResolvedValue(
        mockPaymentMethod
      );
      (mockDeps.customerPaymentMethodsModel.upsertFromStripePaymentMethod as jest.Mock) =
        jest.fn().mockResolvedValue(undefined);
      (mockDeps.zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(null);

      await service.handlePaymentIntentSucceeded(pi);

      expect(mockStripe.paymentMethods.retrieve).toHaveBeenCalledWith(
        'pm_test'
      );
      expect(
        mockDeps.customerPaymentMethodsModel.upsertFromStripePaymentMethod
      ).toHaveBeenCalledWith(mockPaymentMethod, 'cus_test');
    });

    it('should not save payment method when metadata flag is false', async () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        customer: 'cus_test',
        payment_method: 'pm_test',
        metadata: { save_payment_method: 'false' },
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      (mockDeps.paymentIntentModel.upsertPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(undefined);
      (mockDeps.zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(null);

      await service.handlePaymentIntentSucceeded(pi);

      expect(mockStripe.paymentMethods.retrieve).not.toHaveBeenCalled();
    });

    it('should handle payment method save errors gracefully', async () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        customer: 'cus_test',
        payment_method: 'pm_test',
        metadata: { save_payment_method: 'true' },
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      (mockDeps.paymentIntentModel.upsertPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(undefined);
      (mockStripe.paymentMethods.retrieve as jest.Mock).mockRejectedValue(
        new Error('Stripe error')
      );
      (mockDeps.zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(null);

      // Should not throw
      await expect(service.handlePaymentIntentSucceeded(pi)).resolves.not.toThrow();
    });
  });

  describe('handlePaymentIntentFailed', () => {
    it('should upsert payment intent and handle Zeus subscription', async () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        created: 1234567890,
        last_payment_error: {
          message: 'Card declined',
          code: 'card_declined',
        },
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      (mockDeps.paymentIntentModel.upsertPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(undefined);
      (mockDeps.zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(null);

      await service.handlePaymentIntentFailed(pi);

      expect(
        mockDeps.paymentIntentModel.upsertPaymentIntent
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('handlePaymentIntentCanceled', () => {
    it('should upsert payment intent and handle Zeus subscription', async () => {
      const pi = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'canceled',
        created: 1234567890,
        cancellation_reason: 'duplicate',
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      (mockDeps.paymentIntentModel.upsertPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(undefined);
      (mockDeps.zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent as jest.Mock) =
        jest.fn().mockResolvedValue(null);

      await service.handlePaymentIntentCanceled(pi);

      expect(
        mockDeps.paymentIntentModel.upsertPaymentIntent
      ).toHaveBeenCalledTimes(1);
    });
  });
});

