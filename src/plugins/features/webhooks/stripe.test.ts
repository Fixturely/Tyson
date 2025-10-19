import request from 'supertest';
import { idempotencyKeyStore } from "../../../services/idempotency";
import app from '../../../index';

// Mock stripe webhook verification 
jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
      webhooks: {
        constructEvent: jest.fn((body, sig, secret) => {
          if (sig === 'valid_signature') {
            return {
              id: 'evt_test_123',
              type: 'payment_intent.succeeded',
              data: {
                object: {
                  id: 'pi_test_123',
                  amount: 2000,
                  currency: 'usd'
                }
              }
            };
          }
          throw new Error('Invalid signature');
        })
      }
    }));
  });

  describe('Stripe Webhook', ()=>{
    beforeEach(()=>{
        jest.clearAllMocks();
        idempotencyKeyStore.reset();
    })

   it('should process valid webhook events', async()=>{
    const response = await request(app)
    .post('/api/v1/webhooks/stripe')
    .set('stripe-signature', 'valid_signature')
    .send({test:'data'})

    expect(response.status).toBe(200);
   expect(response.body.message).toBe('Webhook received');
   expect(idempotencyKeyStore.hasProcessed('evt_test_123')).toBe(true);
   })

   it('should reject webhooks without signature', async () => {
    const response = await request(app)
      .post('/api/v1/webhooks/stripe')
      .send({ test: 'data' });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal server error');
  });

  it('should reject webhooks with invalid signature', async () => {
    const response = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'invalid_signature')
      .send({ test: 'data' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid signature');
  });

  it('should handle idempotency correctly', async () => {
    // First request
    const response1 = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'valid_signature')
      .send({ test: 'data' });

    expect(response1.status).toBe(200);
    expect(response1.body.message).toBe('Webhook received');

    // Second request (same event)
    const response2 = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'valid_signature')
      .send({ test: 'data' });

    expect(response2.status).toBe(200);
    expect(response2.body.message).toBe('Event already processed');
  });

   
  })