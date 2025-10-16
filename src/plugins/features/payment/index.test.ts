import request from 'supertest';
import app from '../../../index';

jest.mock('../../../services/stripe', () => ({
	createPaymentIntent: jest.fn(async (amount: number, currency: string) => ({
		id: 'pi_test_123', clientSecret: 'secret', status: 'requires_payment_method'
	})),
	confirmPaymentIntent: jest.fn(async (id: string, pm: string) => ({
		id: id, status: 'succeeded'
	})),
}));

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


