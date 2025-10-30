import { CustomerPaymentMethodsModel } from '../customer_payment_methods';
import Stripe from 'stripe';

// Mock the database
jest.mock('../../services/database', () => {
  const mockQueryBuilder = {
    insert: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
    orderBy: jest.fn().mockResolvedValue([]),
    onConflict: jest.fn().mockReturnThis(),
    merge: jest.fn().mockResolvedValue(1),
  } as any;

  const mockDb = jest.fn(() => mockQueryBuilder) as any;

  return {
    __esModule: true,
    default: mockDb,
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('CustomerPaymentMethodsModel', () => {
  let model: CustomerPaymentMethodsModel;
  let mockDb: any;
  let qb: any;

  const stripeCardPm: any = {
    id: 'pm_123',
    type: 'card',
    customer: 'cus_123',
    card: {
      brand: 'visa',
      last4: '4242',
      exp_month: 12,
      exp_year: 2030,
      funding: 'credit',
    },
  } as Stripe.PaymentMethod;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new CustomerPaymentMethodsModel();
    mockDb = require('../../services/database').default;
    qb = mockDb('customer_payment_methods');
  });

  describe('upsertFromStripePaymentMethod', () => {
    it('should map card fields and upsert on payment_method_id', async () => {
      await model.upsertFromStripePaymentMethod(stripeCardPm);

      expect(mockDb).toHaveBeenCalledWith('customer_payment_methods');
      expect(qb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 'cus_123',
          payment_method_id: 'pm_123',
          type: 'card',
          card_brand: 'visa',
          card_last4: '4242',
          card_exp_month: 12,
          card_exp_year: 2030,
          card_funding: 'credit',
          is_default: false,
        })
      );
      expect(qb.onConflict).toHaveBeenCalledWith('payment_method_id');
      expect(qb.merge).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 'cus_123',
          type: 'card',
          updated_at: expect.any(Date),
        })
      );
    });

    it('should prefer explicit customerId when provided', async () => {
      await model.upsertFromStripePaymentMethod(
        { ...stripeCardPm, customer: null } as any,
        'cus_override'
      );

      expect(qb.insert).toHaveBeenCalledWith(
        expect.objectContaining({ customer_id: 'cus_override' })
      );
    });

    it('should rethrow and log on database error', async () => {
      qb.merge.mockRejectedValueOnce(new Error('Upsert failed'));
      await expect(
        model.upsertFromStripePaymentMethod(stripeCardPm)
      ).rejects.toThrow('Upsert failed');
    });
  });

  describe('listByCustomer', () => {
    it('should query by customer and order results', async () => {
      const rows = [
        { id: 1, customer_id: 'cus_123', payment_method_id: 'pm_1' },
        { id: 2, customer_id: 'cus_123', payment_method_id: 'pm_2' },
      ];
      qb.orderBy.mockResolvedValueOnce(rows);

      const result = await model.listByCustomer('cus_123');

      expect(mockDb).toHaveBeenCalledWith('customer_payment_methods');
      expect(qb.where).toHaveBeenCalledWith('customer_id', 'cus_123');
      expect(qb.orderBy).toHaveBeenCalledWith([
        { column: 'is_default', order: 'desc' },
        { column: 'created_at', order: 'desc' },
      ]);
      expect(result).toBe(rows);
    });
  });

  describe('remove', () => {
    it('should delete by payment_method_id', async () => {
      await model.remove('pm_123');

      expect(mockDb).toHaveBeenCalledWith('customer_payment_methods');
      expect(qb.where).toHaveBeenCalledWith('payment_method_id', 'pm_123');
      expect(qb.delete).toHaveBeenCalled();
    });
  });
});
