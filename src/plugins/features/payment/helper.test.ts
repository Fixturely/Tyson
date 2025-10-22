import { createPaymentIntentData, updatePaymentIntentData } from './helper';
import { CreatePaymentIntentResult, ConfirmPaymentIntentResult } from '../../../services/stripe';
import { PaymentIntentData } from '../../../models/payment_intent';

describe('Payment Helper Functions', () => {
  describe('createPaymentIntentData', () => {
    it('should create payment intent data with all fields', () => {
      // Arrange
      const stripeResult: CreatePaymentIntentResult = {
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        client_secret: 'pi_test_123_secret',
        status: 'requires_payment_method',
        customer: 'cus_test_123',
        description: 'Test payment intent',
        metadata: { order_id: 'order_123', source: 'web' },
        created: 1640995200,
        payment_method: 'pm_test_123'
      };

      // Act
      const result = createPaymentIntentData(stripeResult);

      // Assert
      expect(result).toEqual({
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        status: 'requires_payment_method',
        customer_id: 'cus_test_123',
        description: 'Test payment intent',
        metadata: { order_id: 'order_123', source: 'web' },
        client_secret: 'pi_test_123_secret',
        created: 1640995200,
        payment_method: 'pm_test_123'
      });
    });

    it('should create payment intent data with minimal fields', () => {
      // Arrange
      const stripeResult: CreatePaymentIntentResult = {
        id: 'pi_test_456',
        amount: 3000,
        currency: 'eur',
        client_secret: 'pi_test_456_secret',
        status: 'requires_payment_method',
        created: 1640995200
      };

      // Act
      const result = createPaymentIntentData(stripeResult);

      // Assert
      expect(result).toEqual({
        id: 'pi_test_456',
        amount: 3000,
        currency: 'eur',
        status: 'requires_payment_method',
        client_secret: 'pi_test_456_secret',
        created: 1640995200
      });
    });

    it('should handle null optional fields', () => {
      // Arrange
      const stripeResult: CreatePaymentIntentResult = {
        id: 'pi_test_789',
        amount: 2000,
        currency: 'gbp',
        client_secret: null,
        status: 'requires_payment_method',
        customer: null,
        description: null,
        metadata: null,
        created: 1640995200,
        payment_method: null
      };

      // Act
      const result = createPaymentIntentData(stripeResult);

      // Assert
      expect(result).toEqual({
        id: 'pi_test_789',
        amount: 2000,
        currency: 'gbp',
        status: 'requires_payment_method',
        created: 1640995200
      });
    });

    it('should handle undefined optional fields', () => {
      // Arrange
      const stripeResult: CreatePaymentIntentResult = {
        id: 'pi_test_999',
        amount: 1000,
        currency: 'cad',
        client_secret: 'pi_test_999_secret',
        status: 'requires_payment_method',
        created: 1640995200
      };

      // Act
      const result = createPaymentIntentData(stripeResult);

      // Assert
      expect(result).toEqual({
        id: 'pi_test_999',
        amount: 1000,
        currency: 'cad',
        status: 'requires_payment_method',
        client_secret: 'pi_test_999_secret',
        created: 1640995200
      });
    });

    it('should handle empty metadata object', () => {
      // Arrange
      const stripeResult: CreatePaymentIntentResult = {
        id: 'pi_test_empty',
        amount: 1500,
        currency: 'aud',
        client_secret: 'pi_test_empty_secret',
        status: 'requires_payment_method',
        metadata: {},
        created: 1640995200
      };

      // Act
      const result = createPaymentIntentData(stripeResult);

      // Assert
      expect(result).toEqual({
        id: 'pi_test_empty',
        amount: 1500,
        currency: 'aud',
        status: 'requires_payment_method',
        metadata: {},
        client_secret: 'pi_test_empty_secret',
        created: 1640995200
      });
    });

    it('should handle complex metadata', () => {
      // Arrange
      const stripeResult: CreatePaymentIntentResult = {
        id: 'pi_test_complex',
        amount: 7500,
        currency: 'jpy',
        client_secret: 'pi_test_complex_secret',
        status: 'requires_payment_method',
        metadata: {
          order_id: 'order_456',
          user_id: 'user_789',
          items: ['item1', 'item2'],
          pricing: {
            subtotal: 7000,
            tax: 500,
            total: 7500
          }
        },
        created: 1640995200
      };

      // Act
      const result = createPaymentIntentData(stripeResult);

      // Assert
      expect(result).toEqual({
        id: 'pi_test_complex',
        amount: 7500,
        currency: 'jpy',
        status: 'requires_payment_method',
        metadata: {
          order_id: 'order_456',
          user_id: 'user_789',
          items: ['item1', 'item2'],
          pricing: {
            subtotal: 7000,
            tax: 500,
            total: 7500
          }
        },
        client_secret: 'pi_test_complex_secret',
        created: 1640995200
      });
    });
  });

  describe('updatePaymentIntentData', () => {
    it('should create update payment intent data with all fields', () => {
      // Arrange
      const stripeResult: ConfirmPaymentIntentResult = {
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        client_secret: 'pi_test_123_secret',
        status: 'succeeded',
        customer: 'cus_test_123',
        description: 'Test payment intent',
        metadata: { order_id: 'order_123', source: 'web' },
        created: 1640995200,
        payment_method: 'pm_card_visa'
      };

      // Act
      const result = updatePaymentIntentData(stripeResult);

      // Assert
      expect(result).toEqual({
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        status: 'succeeded',
        customer_id: 'cus_test_123',
        description: 'Test payment intent',
        metadata: { order_id: 'order_123', source: 'web' },
        client_secret: 'pi_test_123_secret',
        created: 1640995200,
        payment_method: 'pm_card_visa'
      });
    });

    it('should create update payment intent data with minimal fields', () => {
      // Arrange
      const stripeResult: ConfirmPaymentIntentResult = {
        id: 'pi_test_456',
        amount: 3000,
        currency: 'eur',
        client_secret: 'pi_test_456_secret',
        status: 'succeeded',
        created: 1640995200
      };

      // Act
      const result = updatePaymentIntentData(stripeResult);

      // Assert
      expect(result).toEqual({
        id: 'pi_test_456',
        amount: 3000,
        currency: 'eur',
        status: 'succeeded',
        client_secret: 'pi_test_456_secret',
        created: 1640995200
      });
    });

    it('should handle failed payment status', () => {
      // Arrange
      const stripeResult: ConfirmPaymentIntentResult = {
        id: 'pi_test_failed',
        amount: 2000,
        currency: 'gbp',
        client_secret: 'pi_test_failed_secret',
        status: 'requires_payment_method',
        customer: 'cus_test_failed',
        description: 'Failed payment',
        metadata: { error: 'card_declined' },
        created: 1640995200,
        payment_method: 'pm_card_declined'
      };

      // Act
      const result = updatePaymentIntentData(stripeResult);

      // Assert
      expect(result).toEqual({
        id: 'pi_test_failed',
        amount: 2000,
        currency: 'gbp',
        status: 'requires_payment_method',
        customer_id: 'cus_test_failed',
        description: 'Failed payment',
        metadata: { error: 'card_declined' },
        client_secret: 'pi_test_failed_secret',
        created: 1640995200,
        payment_method: 'pm_card_declined'
      });
    });

    it('should handle canceled payment status', () => {
      // Arrange
      const stripeResult: ConfirmPaymentIntentResult = {
        id: 'pi_test_canceled',
        amount: 1000,
        currency: 'cad',
        client_secret: 'pi_test_canceled_secret',
        status: 'canceled',
        customer: 'cus_test_canceled',
        description: 'Canceled payment',
        metadata: { reason: 'user_canceled' },
        created: 1640995200,
        payment_method: null
      };

      // Act
      const result = updatePaymentIntentData(stripeResult);

      // Assert
      expect(result).toEqual({
        id: 'pi_test_canceled',
        amount: 1000,
        currency: 'cad',
        status: 'canceled',
        customer_id: 'cus_test_canceled',
        description: 'Canceled payment',
        metadata: { reason: 'user_canceled' },
        client_secret: 'pi_test_canceled_secret',
        created: 1640995200
      });
    });

    it('should handle null optional fields in update', () => {
      // Arrange
      const stripeResult: ConfirmPaymentIntentResult = {
        id: 'pi_test_null',
        amount: 2500,
        currency: 'aud',
        client_secret: null,
        status: 'processing',
        customer: null,
        description: null,
        metadata: null,
        created: 1640995200,
        payment_method: null
      };

      // Act
      const result = updatePaymentIntentData(stripeResult);

      // Assert
      expect(result).toEqual({
        id: 'pi_test_null',
        amount: 2500,
        currency: 'aud',
        status: 'processing',
        created: 1640995200
      });
    });

    it('should handle different currency formats', () => {
      // Arrange
      const currencies = ['usd', 'eur', 'gbp', 'jpy', 'cad', 'aud', 'chf', 'sek', 'nok', 'dkk'];
      
      currencies.forEach((currency, index) => {
        const stripeResult: ConfirmPaymentIntentResult = {
          id: `pi_test_${currency}`,
          amount: 1000 + (index * 100),
          currency: currency,
          client_secret: `pi_test_${currency}_secret`,
          status: 'succeeded',
          created: 1640995200
        };

        // Act
        const result = updatePaymentIntentData(stripeResult);

        // Assert
        expect(result.currency).toBe(currency);
        expect(result.amount).toBe(1000 + (index * 100));
        expect(result.id).toBe(`pi_test_${currency}`);
      });
    });

    it('should preserve data types correctly', () => {
      // Arrange
      const stripeResult: ConfirmPaymentIntentResult = {
        id: 'pi_test_types',
        amount: 9999,
        currency: 'usd',
        client_secret: 'pi_test_types_secret',
        status: 'succeeded',
        customer: 'cus_test_types',
        description: 'Type test payment',
        metadata: {
          number: 42,
          boolean: true,
          array: [1, 2, 3],
          nested: { key: 'value' }
        },
        created: 1640995200,
        payment_method: 'pm_test_types'
      };

      // Act
      const result = updatePaymentIntentData(stripeResult);

      // Assert
      expect(typeof result.id).toBe('string');
      expect(typeof result.amount).toBe('number');
      expect(typeof result.currency).toBe('string');
      expect(typeof result.status).toBe('string');
      expect(typeof result.customer_id).toBe('string');
      expect(typeof result.description).toBe('string');
      expect(typeof result.metadata).toBe('object');
      expect(typeof result.created).toBe('number');
      expect(typeof result.payment_method).toBe('string');
      
      expect(result.metadata).toEqual({
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: { key: 'value' }
      });
    });
  });
});
