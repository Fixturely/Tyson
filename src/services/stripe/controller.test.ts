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

import { StripeService, StripeServiceDependencies } from './controller';

// Mock Stripe
const mockStripe = {
  paymentIntents: {
    create: jest.fn(),
    confirm: jest.fn(),
  },
  customers: {
    list: jest.fn(),
    create: jest.fn(),
  },
} as any;

// Mock logger
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('StripeService', () => {
  let service: StripeService;
  let mockDeps: StripeServiceDependencies;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDeps = {
      stripe: mockStripe,
    };

    service = new StripeService(mockDeps);
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent with required fields', async () => {
      const mockPI = {
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
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      mockStripe.paymentIntents.create.mockResolvedValue(mockPI);

      const result = await service.createPaymentIntent(2000, 'usd');

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 2000,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
      });
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

    it('should include optional fields when provided', async () => {
      const mockPI = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        created: 1234567890,
        client_secret: 'pi_test_123_secret',
        customer: 'cus_test',
        description: 'Test payment',
        metadata: { order_id: 'order_123' },
        payment_method: 'pm_test',
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      mockStripe.paymentIntents.create.mockResolvedValue(mockPI);

      const result = await service.createPaymentIntent(2000, 'usd', {
        customer: 'cus_test',
        description: 'Test payment',
        metadata: { order_id: 'order_123' },
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 2000,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        customer: 'cus_test',
        description: 'Test payment',
        metadata: { order_id: 'order_123' },
      });
      expect(result.customer).toBe('cus_test');
      expect(result.description).toBe('Test payment');
    });

    it('should use default currency when not provided', async () => {
      const mockPI = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'requires_payment_method',
        created: 1234567890,
        client_secret: 'pi_test_123_secret',
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      mockStripe.paymentIntents.create.mockResolvedValue(mockPI);

      await service.createPaymentIntent(2000);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'usd',
        })
      );
    });
  });

  describe('confirmPaymentIntent', () => {
    it('should confirm payment intent with default payment method', async () => {
      const mockPI = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        client_secret: 'pi_test_123_secret',
        customer: 'cus_test',
        payment_method: 'pm_test',
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      mockStripe.paymentIntents.confirm.mockResolvedValue(mockPI);

      const result = await service.confirmPaymentIntent('pi_test_123');

      expect(mockStripe.paymentIntents.confirm).toHaveBeenCalledWith(
        'pi_test_123',
        {
          payment_method: 'pm_card_visa',
        }
      );
      expect(result.status).toBe('succeeded');
    });

    it('should confirm payment intent with custom payment method', async () => {
      const mockPI = {
        id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
        created: 1234567890,
        client_secret: 'pi_test_123_secret',
        object: 'payment_intent',
      } as unknown as Stripe.PaymentIntent;

      mockStripe.paymentIntents.confirm.mockResolvedValue(mockPI);

      await service.confirmPaymentIntent('pi_test_123', 'pm_custom');

      expect(mockStripe.paymentIntents.confirm).toHaveBeenCalledWith(
        'pi_test_123',
        {
          payment_method: 'pm_custom',
        }
      );
    });
  });

  describe('createOrGetStripeCustomer', () => {
    it('should return existing customer when found', async () => {
      const existingCustomer = {
        id: 'cus_existing',
        email: 'test@example.com',
        name: 'Test User',
      } as Stripe.Customer;

      mockStripe.customers.list.mockResolvedValue({
        data: [existingCustomer],
      });

      const result = await service.createOrGetStripeCustomer({
        email: 'test@example.com',
      });

      expect(mockStripe.customers.list).toHaveBeenCalledWith({
        email: 'test@example.com',
        limit: 1,
      });
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingCustomer);
    });

    it('should create new customer when not found', async () => {
      const newCustomer = {
        id: 'cus_new',
        email: 'new@example.com',
        name: 'New User',
      } as Stripe.Customer;

      mockStripe.customers.list.mockResolvedValue({
        data: [],
      });
      mockStripe.customers.create.mockResolvedValue(newCustomer);

      const result = await service.createOrGetStripeCustomer({
        email: 'new@example.com',
        name: 'New User',
      });

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        name: 'New User',
      });
      expect(result).toEqual(newCustomer);
    });

    it('should handle customer creation without name', async () => {
      const newCustomer = {
        id: 'cus_new',
        email: 'new@example.com',
        name: '',
      } as Stripe.Customer;

      mockStripe.customers.list.mockResolvedValue({
        data: [],
      });
      mockStripe.customers.create.mockResolvedValue(newCustomer);

      const result = await service.createOrGetStripeCustomer({
        email: 'new@example.com',
      });

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        name: '',
      });
      expect(result).toEqual(newCustomer);
    });

    it('should throw error when Stripe API fails', async () => {
      const error = new Error('Stripe API error');
      mockStripe.customers.list.mockRejectedValue(error);

      await expect(
        service.createOrGetStripeCustomer({
          email: 'test@example.com',
        })
      ).rejects.toThrow('Stripe API error');
    });
  });
});
