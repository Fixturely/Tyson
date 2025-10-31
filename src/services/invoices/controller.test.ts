import Stripe from 'stripe';
import { InvoicesService, InvoicesServiceDependencies } from './controller';
import { zeusSubscriptionModel } from '../../models/zeus_subscriptions';
import { zeusNotificationService } from '../notifications';

// Mock database to prevent knex initialization
jest.mock('../../services/database', () => ({
  default: {},
}));

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

describe('InvoicesService', () => {
  let service: InvoicesService;
  let mockDeps: InvoicesServiceDependencies;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDeps = {
      zeusSubscriptionModel: zeusSubscriptionModel as any,
      zeusNotificationService: zeusNotificationService as any,
    };

    service = new InvoicesService(mockDeps);
  });

  describe('handleInvoicePaymentSucceeded', () => {
    it('should update subscription and notify Zeus on successful invoice payment', async () => {
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

      const subscription = {
        subscription_id: 789,
        user_id: 101,
        sport_id: 1,
        team_id: 42,
        currency: 'usd',
      };

      (
        mockDeps.zeusSubscriptionModel
          .getZeusSubscriptionByPaymentIntent as jest.Mock
      ).mockResolvedValue(subscription);
      (
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus as jest.Mock
      ).mockResolvedValue(undefined);
      (
        mockDeps.zeusNotificationService.notifyPaymentSucceeded as jest.Mock
      ).mockResolvedValue(undefined);
      (
        mockDeps.zeusSubscriptionModel.markZeusNotified as jest.Mock
      ).mockResolvedValue(undefined);

      await service.handleInvoicePaymentSucceeded(invoice);

      expect(
        mockDeps.zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent
      ).toHaveBeenCalledWith('pi_test_123');
      expect(
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus
      ).toHaveBeenCalledWith(789, 'succeeded', expect.any(Date));
      expect(
        mockDeps.zeusNotificationService.notifyPaymentSucceeded
      ).toHaveBeenCalled();
      expect(
        mockDeps.zeusSubscriptionModel.markZeusNotified
      ).toHaveBeenCalledWith(789);
    });

    it('should return early when no payment intent ID found', async () => {
      const invoice = {
        id: 'in_test_123',
        amount_paid: 2000,
        payment_intent: null,
      } as unknown as Stripe.Invoice;

      await service.handleInvoicePaymentSucceeded(invoice);

      expect(
        mockDeps.zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent
      ).not.toHaveBeenCalled();
    });

    it('should return early when no subscription found', async () => {
      const invoice = {
        id: 'in_test_123',
        payment_intent: 'pi_test_123',
      } as unknown as Stripe.Invoice;

      (
        mockDeps.zeusSubscriptionModel
          .getZeusSubscriptionByPaymentIntent as jest.Mock
      ).mockResolvedValue(null);

      await service.handleInvoicePaymentSucceeded(invoice);

      expect(
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus
      ).not.toHaveBeenCalled();
    });

    it('should handle payment_intent as object', async () => {
      const invoice = {
        id: 'in_test_123',
        payment_intent: {
          id: 'pi_test_456',
        },
      } as unknown as Stripe.Invoice;

      (
        mockDeps.zeusSubscriptionModel
          .getZeusSubscriptionByPaymentIntent as jest.Mock
      ).mockResolvedValue(null);

      await service.handleInvoicePaymentSucceeded(invoice);

      expect(
        mockDeps.zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent
      ).toHaveBeenCalledWith('pi_test_456');
    });

    it('should use current date when paid_at timestamp not available', async () => {
      const invoice = {
        id: 'in_test_123',
        payment_intent: 'pi_test_123',
        status_transitions: {},
      } as unknown as Stripe.Invoice;

      const subscription = {
        subscription_id: 789,
        user_id: 101,
        currency: 'usd',
      };

      (
        mockDeps.zeusSubscriptionModel
          .getZeusSubscriptionByPaymentIntent as jest.Mock
      ).mockResolvedValue(subscription);
      (
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus as jest.Mock
      ).mockResolvedValue(undefined);

      await service.handleInvoicePaymentSucceeded(invoice);

      expect(
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus
      ).toHaveBeenCalledWith(789, 'succeeded', expect.any(Date));
    });

    it('should handle notification errors gracefully', async () => {
      const invoice = {
        id: 'in_test_123',
        payment_intent: 'pi_test_123',
      } as unknown as Stripe.Invoice;

      const subscription = {
        subscription_id: 789,
        user_id: 101,
        currency: 'usd',
      };

      (
        mockDeps.zeusSubscriptionModel
          .getZeusSubscriptionByPaymentIntent as jest.Mock
      ).mockResolvedValue(subscription);
      (
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus as jest.Mock
      ).mockResolvedValue(undefined);
      (
        mockDeps.zeusNotificationService.notifyPaymentSucceeded as jest.Mock
      ).mockRejectedValue(new Error('Notification failed'));

      // Should not throw
      await service.handleInvoicePaymentSucceeded(invoice);

      // Verify subscription was still updated
      expect(
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus
      ).toHaveBeenCalled();
    });
  });

  describe('handleInvoicePaymentFailed', () => {
    it('should update subscription and notify Zeus on failed invoice payment', async () => {
      const invoice = {
        id: 'in_test_123',
        amount_due: 2000,
        currency: 'usd',
        payment_intent: 'pi_test_123',
        attempt_count: 1,
        charge: {
          outcome: {
            reason: 'Card declined',
          },
        },
      } as unknown as Stripe.Invoice;

      const subscription = {
        subscription_id: 789,
        user_id: 101,
        currency: 'usd',
      };

      (
        mockDeps.zeusSubscriptionModel
          .getZeusSubscriptionByPaymentIntent as jest.Mock
      ).mockResolvedValue(subscription);
      (
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus as jest.Mock
      ).mockResolvedValue(undefined);
      (
        mockDeps.zeusNotificationService.notifyPaymentFailed as jest.Mock
      ).mockResolvedValue(undefined);

      await service.handleInvoicePaymentFailed(invoice);

      expect(
        mockDeps.zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent
      ).toHaveBeenCalledWith('pi_test_123');
      expect(
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus
      ).toHaveBeenCalledWith(789, 'failed');
      expect(
        mockDeps.zeusNotificationService.notifyPaymentFailed
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: 'Card declined',
        })
      );
    });

    it('should use fallback error message when last_payment_error not available', async () => {
      const invoice = {
        id: 'in_test_123',
        payment_intent: 'pi_test_123',
        attempt_count: 2,
      } as unknown as Stripe.Invoice;

      const subscription = {
        subscription_id: 789,
        user_id: 101,
        currency: 'usd',
      };

      (
        mockDeps.zeusSubscriptionModel
          .getZeusSubscriptionByPaymentIntent as jest.Mock
      ).mockResolvedValue(subscription);
      (
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus as jest.Mock
      ).mockResolvedValue(undefined);
      (
        mockDeps.zeusNotificationService.notifyPaymentFailed as jest.Mock
      ).mockResolvedValue(undefined);

      await service.handleInvoicePaymentFailed(invoice);

      expect(
        mockDeps.zeusNotificationService.notifyPaymentFailed
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: 'Payment attempt 2 failed',
        })
      );
    });

    it('should use generic message when attempt_count not available', async () => {
      const invoice = {
        id: 'in_test_123',
        payment_intent: 'pi_test_123',
      } as unknown as Stripe.Invoice;

      const subscription = {
        subscription_id: 789,
        user_id: 101,
        currency: 'usd',
      };

      (
        mockDeps.zeusSubscriptionModel
          .getZeusSubscriptionByPaymentIntent as jest.Mock
      ).mockResolvedValue(subscription);
      (
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus as jest.Mock
      ).mockResolvedValue(undefined);
      (
        mockDeps.zeusNotificationService.notifyPaymentFailed as jest.Mock
      ).mockResolvedValue(undefined);

      await service.handleInvoicePaymentFailed(invoice);

      expect(
        mockDeps.zeusNotificationService.notifyPaymentFailed
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          error_message: 'Payment failed',
        })
      );
    });

    it('should return early when no payment intent ID found', async () => {
      const invoice = {
        id: 'in_test_123',
        payment_intent: null,
      } as unknown as Stripe.Invoice;

      await service.handleInvoicePaymentFailed(invoice);

      expect(
        mockDeps.zeusSubscriptionModel.getZeusSubscriptionByPaymentIntent
      ).not.toHaveBeenCalled();
    });

    it('should return early when no subscription found', async () => {
      const invoice = {
        id: 'in_test_123',
        payment_intent: 'pi_test_123',
      } as unknown as Stripe.Invoice;

      (
        mockDeps.zeusSubscriptionModel
          .getZeusSubscriptionByPaymentIntent as jest.Mock
      ).mockResolvedValue(null);

      await service.handleInvoicePaymentFailed(invoice);

      expect(
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus
      ).not.toHaveBeenCalled();
    });

    it('should handle notification errors gracefully', async () => {
      const invoice = {
        id: 'in_test_123',
        payment_intent: 'pi_test_123',
      } as unknown as Stripe.Invoice;

      const subscription = {
        subscription_id: 789,
        user_id: 101,
        currency: 'usd',
      };

      (
        mockDeps.zeusSubscriptionModel
          .getZeusSubscriptionByPaymentIntent as jest.Mock
      ).mockResolvedValue(subscription);
      (
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus as jest.Mock
      ).mockResolvedValue(undefined);
      (
        mockDeps.zeusNotificationService.notifyPaymentFailed as jest.Mock
      ).mockRejectedValue(new Error('Notification failed'));

      // Should not throw
      await service.handleInvoicePaymentFailed(invoice);

      // Verify subscription was still updated
      expect(
        mockDeps.zeusSubscriptionModel.updateZeusSubscriptionStatus
      ).toHaveBeenCalled();
    });
  });
});
