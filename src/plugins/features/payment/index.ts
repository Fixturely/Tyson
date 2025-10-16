import express from 'express';
import { createPaymentIntent, confirmPaymentIntent } from '../../../services/stripe';
const router = express.Router();

  router.post('/payments/intent', async (req, res) => {
    try {
      const { amount, currency } = req.body;
      if (!amount || typeof amount !== 'number') {
        return res.status(400).json({ error: 'amount (number, in cents) is required' });
      }
      const result = await createPaymentIntent(amount, currency || 'usd');
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to create payment intent' });
    }
  });

  router.post('/payments/intent/:id/confirm', async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentMethod } = req.body || {};
      if (!id) {
        return res.status(400).json({ error: 'payment_intent id is required' });
      }
      const result = await confirmPaymentIntent(id, paymentMethod || 'pm_card_visa');
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to confirm payment intent' });
    }
  });

  export default router;