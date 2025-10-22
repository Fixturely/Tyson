import request from 'supertest';
import express from 'express';

// Create a minimal app for testing just the health routes
const app = express();

// Import the health router directly
import healthRouter from './index';
app.use('/api/v1', healthRouter);

describe('Health routes', () => {
  it('GET /api/v1/health should return OK', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});
