// Mock dependencies FIRST (before imports)
jest.mock('../../../services/stripe', () => ({
  createPaymentIntent: jest.fn(),
  confirmPaymentIntent: jest.fn(),
  createOrGetStripeCustomer: jest.fn(),
}));

const mockZeusSubscriptionModel = {
  createZeusSubscription: jest.fn(),
};

jest.mock('../../../models/zeus_subscriptions', () => ({
  zeusSubscriptionModel: mockZeusSubscriptionModel,
}));

jest.mock('../../../models/payment_intent', () => ({
  paymentIntentModel: {
    createPaymentIntent: jest.fn(),
    updatePaymentIntent: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

import { Request, Response } from 'express';
import {
  createPaymentIntentController,
  confirmPaymentIntentController,
  createZeusSubscriptionPaymentController,
} from './controller';
import {
  createPaymentIntent,
  confirmPaymentIntent,
  createOrGetStripeCustomer,
} from '../../../services/stripe';
import { paymentIntentModel } from '../../../models/payment_intent';
import logger from '../../../utils/logger';

const mockCreatePaymentIntent =
  createPaymentIntent as unknown as jest.MockedFunction<
    typeof createPaymentIntent
  >;
const mockConfirmPaymentIntent =
  confirmPaymentIntent as unknown as jest.MockedFunction<
    typeof confirmPaymentIntent
  >;
const mockCreateOrGetStripeCustomer =
  createOrGetStripeCustomer as unknown as jest.MockedFunction<
    typeof createOrGetStripeCustomer
  >;
const mockPaymentIntentModel = paymentIntentModel as unknown as {
  createPaymentIntent: jest.Mock;
  updatePaymentIntent: jest.Mock;
};
const mockLogger = logger as unknown as {
  error: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
};

describe('Payment Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnThis();

    mockRequest = {
      body: {},
      params: {},
    };

    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('createPaymentIntentController', () => {
    it('should create a payment intent successfully', async () => {
      // Arrange
      const requestBody = { amount: 5000, currency: 'usd' };
      const stripeResult = {
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        client_secret: 'pi_test_123_secret',
        status: 'requires_payment_method',
        customer: 'cus_test_123',
        description: 'Test payment',
        metadata: { order_id: 'order_123' },
        created: 1640995200,
        payment_method: 'pm_test_123',
      };

      mockRequest.body = requestBody;
      mockCreatePaymentIntent.mockResolvedValue(stripeResult);
      mockPaymentIntentModel.createPaymentIntent.mockResolvedValue(undefined);

      // Act
      await createPaymentIntentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockCreatePaymentIntent).toHaveBeenCalledWith(5000, 'usd');
      expect(mockPaymentIntentModel.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pi_test_123',
          amount: 5000,
          currency: 'usd',
          status: 'requires_payment_method',
          customer_id: 'cus_test_123',
          description: 'Test payment',
          metadata: { order_id: 'order_123' },
          created: 1640995200,
          payment_method: 'pm_test_123',
        })
      );
      expect(mockJson).toHaveBeenCalledWith(stripeResult);
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should create a payment intent with default currency', async () => {
      // Arrange
      // Simulate validation middleware behavior - Joi sets default currency
      const requestBody = { amount: 3000, currency: 'usd' };
      const stripeResult = {
        id: 'pi_test_456',
        amount: 3000,
        currency: 'usd',
        client_secret: 'pi_test_456_secret',
        status: 'requires_payment_method',
        created: 1640995200,
      };

      mockRequest.body = requestBody;
      mockCreatePaymentIntent.mockResolvedValue(stripeResult);
      mockPaymentIntentModel.createPaymentIntent.mockResolvedValue(undefined);

      // Act
      await createPaymentIntentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockCreatePaymentIntent).toHaveBeenCalledWith(3000, 'usd');
      expect(mockJson).toHaveBeenCalledWith(stripeResult);
    });

    it('should handle Stripe service errors', async () => {
      // Arrange
      const requestBody = { amount: 5000, currency: 'usd' };
      const stripeError = new Error('Stripe API error');

      mockRequest.body = requestBody;
      mockCreatePaymentIntent.mockRejectedValue(stripeError);

      // Act
      await createPaymentIntentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create payment intent: Stripe API error',
        { error: stripeError }
      );
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Failed to create payment intent',
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const requestBody = { amount: 5000, currency: 'usd' };
      const stripeResult = {
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        client_secret: 'pi_test_123_secret',
        status: 'requires_payment_method',
        created: 1640995200,
      };
      const dbError = new Error('Database connection failed');

      mockRequest.body = requestBody;
      mockCreatePaymentIntent.mockResolvedValue(stripeResult);
      mockPaymentIntentModel.createPaymentIntent.mockRejectedValue(dbError);

      // Act
      await createPaymentIntentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create payment intent: Database connection failed',
        { error: dbError }
      );
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Failed to create payment intent',
      });
    });

    it('should handle missing amount in request body', async () => {
      // Arrange
      const requestBody = { currency: 'usd' };
      const stripeError = new Error('Amount is required');

      mockRequest.body = requestBody;
      mockCreatePaymentIntent.mockRejectedValue(stripeError);

      // Act
      await createPaymentIntentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create payment intent: Amount is required',
        { error: stripeError }
      );
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Failed to create payment intent',
      });
    });
  });

  describe('confirmPaymentIntentController', () => {
    it('should confirm a payment intent successfully', async () => {
      // Arrange
      const requestParams = { id: 'pi_test_123' };
      const requestBody = { paymentMethod: 'pm_card_visa' };
      const stripeResult = {
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        client_secret: 'pi_test_123_secret',
        status: 'succeeded',
        customer: 'cus_test_123',
        description: 'Test payment',
        metadata: { order_id: 'order_123' },
        created: 1640995200,
        payment_method: 'pm_card_visa',
      };

      mockRequest.params = requestParams;
      mockRequest.body = requestBody;
      mockConfirmPaymentIntent.mockResolvedValue(stripeResult);
      mockPaymentIntentModel.updatePaymentIntent.mockResolvedValue(undefined);

      // Act
      await confirmPaymentIntentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockConfirmPaymentIntent).toHaveBeenCalledWith(
        'pi_test_123',
        'pm_card_visa'
      );
      expect(mockPaymentIntentModel.updatePaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pi_test_123',
          amount: 5000,
          currency: 'usd',
          status: 'succeeded',
          customer_id: 'cus_test_123',
          description: 'Test payment',
          metadata: { order_id: 'order_123' },
          created: 1640995200,
          payment_method: 'pm_card_visa',
        })
      );
      expect(mockJson).toHaveBeenCalledWith(stripeResult);
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should confirm payment intent with default payment method', async () => {
      // Arrange
      const requestParams = { id: 'pi_test_123' };
      const requestBody = {};
      const stripeResult = {
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        client_secret: 'pi_test_123_secret',
        status: 'succeeded',
        created: 1640995200,
      };

      mockRequest.params = requestParams;
      mockRequest.body = requestBody;
      mockConfirmPaymentIntent.mockResolvedValue(stripeResult);
      mockPaymentIntentModel.updatePaymentIntent.mockResolvedValue(undefined);

      // Act
      await confirmPaymentIntentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockConfirmPaymentIntent).toHaveBeenCalledWith(
        'pi_test_123',
        'pm_card_visa'
      );
      expect(mockJson).toHaveBeenCalledWith(stripeResult);
    });

    it('should return 400 when payment intent id is missing', async () => {
      // Arrange
      const requestParams = {};
      const requestBody = { paymentMethod: 'pm_card_visa' };

      mockRequest.params = requestParams;
      mockRequest.body = requestBody;

      // Act
      await confirmPaymentIntentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'payment_intent id is required',
      });
      expect(mockConfirmPaymentIntent).not.toHaveBeenCalled();
    });

    it('should handle Stripe confirmation errors', async () => {
      // Arrange
      const requestParams = { id: 'pi_test_123' };
      const requestBody = { paymentMethod: 'pm_card_visa' };
      const stripeError = new Error('Payment method not found');

      mockRequest.params = requestParams;
      mockRequest.body = requestBody;
      mockConfirmPaymentIntent.mockRejectedValue(stripeError);

      // Act
      await confirmPaymentIntentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to confirm payment intent: Payment method not found',
        { error: stripeError }
      );
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Failed to confirm payment intent',
      });
    });

    it('should handle database update errors', async () => {
      // Arrange
      const requestParams = { id: 'pi_test_123' };
      const requestBody = { paymentMethod: 'pm_card_visa' };
      const stripeResult = {
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        client_secret: 'pi_test_123_secret',
        status: 'succeeded',
        created: 1640995200,
      };
      const dbError = new Error('Database update failed');

      mockRequest.params = requestParams;
      mockRequest.body = requestBody;
      mockConfirmPaymentIntent.mockResolvedValue(stripeResult);
      mockPaymentIntentModel.updatePaymentIntent.mockRejectedValue(dbError);

      // Act
      await confirmPaymentIntentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to confirm payment intent: Database update failed',
        { error: dbError }
      );
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Failed to confirm payment intent',
      });
    });

    it('should handle invalid payment intent id', async () => {
      // Arrange
      const requestParams = { id: 'invalid_id' };
      const requestBody = { paymentMethod: 'pm_card_visa' };
      const stripeError = new Error('No such payment_intent: invalid_id');

      mockRequest.params = requestParams;
      mockRequest.body = requestBody;
      mockConfirmPaymentIntent.mockRejectedValue(stripeError);

      // Act
      await confirmPaymentIntentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to confirm payment intent: No such payment_intent: invalid_id',
        { error: stripeError }
      );
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Failed to confirm payment intent',
      });
    });
  });

  describe('createZeusSubscriptionPaymentController', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create a Zeus subscription payment successfully', async () => {
      // Arrange
      const requestBody = {
        subscription_id: 123,
        user_id: 456,
        amount: 5000,
        currency: 'usd',
        description: 'Basketball subscription',
        metadata: {
          sport_id: 1,
          team_id: 5,
          subscription_type: 'monthly',
        },
        customer_info: {
          email: 'user@example.com',
          name: 'John Doe',
        },
      };

      const stripeCustomer = {
        id: 'cus_test_123',
        email: 'user@example.com',
        name: 'John Doe',
      } as any;

      const stripeResult = {
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        client_secret: 'pi_test_123_secret',
        status: 'requires_payment_method',
        customer: 'cus_test_123',
        description: 'Basketball subscription',
        metadata: {
          subscription_id: 123,
          user_id: 456,
          sport_id: 1,
          team_id: 5,
          subscription_type: 'monthly',
        },
        created: 1640995200,
      };

      mockRequest.body = requestBody;
      mockCreateOrGetStripeCustomer.mockResolvedValue(stripeCustomer);
      mockCreatePaymentIntent.mockResolvedValue(stripeResult);
      mockPaymentIntentModel.createPaymentIntent.mockResolvedValue(undefined);
      mockZeusSubscriptionModel.createZeusSubscription.mockResolvedValue(
        undefined
      );

      // Act
      await createZeusSubscriptionPaymentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockCreateOrGetStripeCustomer).toHaveBeenCalledWith({
        email: 'user@example.com',
        name: 'John Doe',
      });
      expect(mockCreatePaymentIntent).toHaveBeenCalledWith(5000, 'usd', {
        customer: 'cus_test_123',
        description: 'Basketball subscription',
        metadata: {
          subscription_id: 123,
          user_id: 456,
          sport_id: 1,
          team_id: 5,
          subscription_type: 'monthly',
        },
      });
      expect(mockPaymentIntentModel.createPaymentIntent).toHaveBeenCalled();
      expect(
        mockZeusSubscriptionModel.createZeusSubscription
      ).toHaveBeenCalledWith({
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        status: 'pending',
        sport_id: 1,
        team_id: 5,
        subscription_type: 'monthly',
        customer_email: 'user@example.com',
        customer_name: 'John Doe',
      });
      expect(mockJson).toHaveBeenCalledWith({
        payment_intent_id: 'pi_test_123',
        client_secret: 'pi_test_123_secret',
        status: 'requires_payment_method',
      });
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should create Zeus subscription with default description', async () => {
      // Arrange
      const requestBody = {
        subscription_id: 456,
        user_id: 789,
        amount: 3000,
        currency: 'usd',
        customer_info: {
          email: 'test@example.com',
          name: 'Jane Doe',
        },
      };

      const stripeCustomer = {
        id: 'cus_test_456',
        email: 'test@example.com',
        name: 'Jane Doe',
      } as any;

      const stripeResult = {
        id: 'pi_test_456',
        amount: 3000,
        currency: 'usd',
        client_secret: 'pi_test_456_secret',
        status: 'requires_payment_method',
        customer: 'cus_test_456',
        description: 'Zeus Subscription Payment - 456',
        metadata: {
          subscription_id: 456,
          user_id: 789,
        },
        created: 1640995200,
      };

      mockRequest.body = requestBody;
      mockCreateOrGetStripeCustomer.mockResolvedValue(stripeCustomer);
      mockCreatePaymentIntent.mockResolvedValue(stripeResult);
      mockPaymentIntentModel.createPaymentIntent.mockResolvedValue(undefined);
      mockZeusSubscriptionModel.createZeusSubscription.mockResolvedValue(
        undefined
      );

      // Act
      await createZeusSubscriptionPaymentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockCreatePaymentIntent).toHaveBeenCalledWith(3000, 'usd', {
        customer: 'cus_test_456',
        description: 'Zeus Subscription Payment - 456',
        metadata: {
          subscription_id: 456,
          user_id: 789,
        },
      });
      expect(mockJson).toHaveBeenCalledWith({
        payment_intent_id: 'pi_test_456',
        client_secret: 'pi_test_456_secret',
        status: 'requires_payment_method',
      });
    });

    it('should handle Stripe customer creation errors', async () => {
      // Arrange
      const requestBody = {
        subscription_id: 123,
        user_id: 456,
        amount: 5000,
        currency: 'usd',
        customer_info: {
          email: 'user@example.com',
          name: 'John Doe',
        },
      };

      const stripeError = new Error('Stripe customer creation failed');

      mockRequest.body = requestBody;
      mockCreateOrGetStripeCustomer.mockRejectedValue(stripeError);

      // Act
      await createZeusSubscriptionPaymentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create Zeus subscription payment: Stripe customer creation failed',
        { error: stripeError }
      );
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Failed to create Zeus subscription payment',
      });
    });

    it('should handle Stripe payment intent creation errors', async () => {
      // Arrange
      const requestBody = {
        subscription_id: 123,
        user_id: 456,
        amount: 5000,
        currency: 'usd',
        customer_info: {
          email: 'user@example.com',
          name: 'John Doe',
        },
      };

      const stripeCustomer = {
        id: 'cus_test_123',
        email: 'user@example.com',
        name: 'John Doe',
      } as any;

      const stripeError = new Error('Stripe payment intent creation failed');

      mockRequest.body = requestBody;
      mockCreateOrGetStripeCustomer.mockResolvedValue(stripeCustomer);
      mockCreatePaymentIntent.mockRejectedValue(stripeError);

      // Act
      await createZeusSubscriptionPaymentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create Zeus subscription payment: Stripe payment intent creation failed',
        { error: stripeError }
      );
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Failed to create Zeus subscription payment',
      });
    });

    it('should handle database errors when creating payment intent', async () => {
      // Arrange
      const requestBody = {
        subscription_id: 123,
        user_id: 456,
        amount: 5000,
        currency: 'usd',
        customer_info: {
          email: 'user@example.com',
          name: 'John Doe',
        },
      };

      const stripeCustomer = {
        id: 'cus_test_123',
        email: 'user@example.com',
        name: 'John Doe',
      } as any;

      const stripeResult = {
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        client_secret: 'pi_test_123_secret',
        status: 'requires_payment_method',
        customer: 'cus_test_123',
        description: 'Zeus Subscription Payment - sub_123',
        metadata: {
          subscription_id: 123,
          user_id: 456,
        },
        created: 1640995200,
      };

      const dbError = new Error('Database payment intent creation failed');

      mockRequest.body = requestBody;
      mockCreateOrGetStripeCustomer.mockResolvedValue(stripeCustomer);
      mockCreatePaymentIntent.mockResolvedValue(stripeResult);
      mockPaymentIntentModel.createPaymentIntent.mockRejectedValue(dbError);

      // Act
      await createZeusSubscriptionPaymentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create Zeus subscription payment: Database payment intent creation failed',
        { error: dbError }
      );
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Failed to create Zeus subscription payment',
      });
    });

    it('should handle database errors when creating Zeus subscription', async () => {
      // Arrange
      const requestBody = {
        subscription_id: 123,
        user_id: 456,
        amount: 5000,
        currency: 'usd',
        customer_info: {
          email: 'user@example.com',
          name: 'John Doe',
        },
      };

      const stripeCustomer = {
        id: 'cus_test_123',
        email: 'user@example.com',
        name: 'John Doe',
      } as any;

      const stripeResult = {
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        client_secret: 'pi_test_123_secret',
        status: 'requires_payment_method',
        customer: 'cus_test_123',
        description: 'Zeus Subscription Payment - sub_123',
        metadata: {
          subscription_id: 123,
          user_id: 456,
        },
        created: 1640995200,
      };

      const dbError = new Error('Database Zeus subscription creation failed');

      mockRequest.body = requestBody;
      mockCreateOrGetStripeCustomer.mockResolvedValue(stripeCustomer);
      mockCreatePaymentIntent.mockResolvedValue(stripeResult);
      mockPaymentIntentModel.createPaymentIntent.mockResolvedValue(undefined);
      mockZeusSubscriptionModel.createZeusSubscription.mockRejectedValue(
        dbError
      );

      // Act
      await createZeusSubscriptionPaymentController(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create Zeus subscription payment: Database Zeus subscription creation failed',
        { error: dbError }
      );
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Failed to create Zeus subscription payment',
      });
    });
  });
});
