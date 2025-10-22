import request from 'supertest';
import express from 'express';

// Mock database service
jest.mock('../../../services/database', () => {
  const mockQueryBuilder = {
    insert: jest.fn().mockResolvedValue([1]),
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    first: jest.fn().mockResolvedValue(null),
    orderBy: jest.fn().mockResolvedValue([]),
  };

  return {
    __esModule: true,
    default: jest.fn(() => mockQueryBuilder),
  };
});

// Mock Stripe service
jest.mock('../../../services/stripe', () => ({
  createPaymentIntent: jest.fn(async (amount: number, currency: string) => ({
    id: 'pi_test_123',
    amount: amount,
    currency: currency,
    client_secret: 'secret',
    status: 'requires_payment_method',
  })),
  confirmPaymentIntent: jest.fn(async (id: string, pm: string) => ({
    id: id,
    amount: 5000,
    currency: 'usd',
    status: 'succeeded',
  })),
}));

// Create a minimal app for testing just the payment routes
const app = express();
app.use(express.json());

// Import the payment router directly
import paymentRouter from './index';
app.use('/api/v1', paymentRouter);

describe('Payments routes', () => {
  it('POST /api/v1/payments/intent should create a payment intent', async () => {
    const res = await request(app)
      .post('/api/v1/payments/intent')
      .send({ amount: 5000, currency: 'usd' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('pi_test_123');
  });

  it('POST /api/v1/payments/intent/:id/confirm should confirm', async () => {
    const res = await request(app)
      .post('/api/v1/payments/intent/pi_test_123/confirm')
      .send({ paymentMethod: 'pm_card_visa' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('succeeded');
  });
});
