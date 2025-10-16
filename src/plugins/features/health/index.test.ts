import request from 'supertest';
import app from '../../../index';

describe('Health routes', () => {
	it('GET /api/v1/health should return OK', async () => {
		const res = await request(app).get('/api/v1/health');
		expect(res.status).toBe(200);
		expect(res.body.status).toBe('OK');
	});
});


