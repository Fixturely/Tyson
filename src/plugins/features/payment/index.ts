import express from 'express';
import { createPaymentIntent, confirmPaymentIntent } from '../../../services/stripe';
import logger from '../../../utils/logger';
import { validateBody } from '../../../middleware/validate';
import { createIntentSchema, confirmSchema } from './validator';
const router = express.Router();

  router.post('/payments/intent', validateBody(createIntentSchema), async (req, res) => {
    try {
      const { amount, currency } = req.body;
      const result = await createPaymentIntent(amount, currency || 'usd');
      return res.json(result);
    } catch (err: any) {
      logger.error(`Failed to create payment intent: ${err.message}`, { error: err });
      return res.status(500).json({ error: 'Failed to create payment intent' });
    }
  });

  router.post('/payments/intent/:id/confirm', validateBody(confirmSchema), async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentMethod } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'payment_intent id is required' });
      }
      // paymentMethod defaulted by schema
      const result = await confirmPaymentIntent(id, paymentMethod);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to confirm payment intent' });
    }
  });

  export default router;