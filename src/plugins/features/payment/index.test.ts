import request from 'supertest';
import express from 'express';
import { createPaymentIntent, confirmPaymentIntent } from '../../../services/stripe';

// Mock Stripe service
jest.mock('../../../services/stripe', () => ({
	createPaymentIntent: jest.fn(async (amount: number, currency: string) => ({
		id: 'pi_test_123', client_secret: 'secret', status: 'requires_payment_method'
	})),
	confirmPaymentIntent: jest.fn(async (id: string, pm: string) => ({
		id: id, status: 'succeeded'
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


