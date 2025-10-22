import { Request, Response } from 'express';
import {
  confirmPaymentIntent,
  createPaymentIntent,
} from '../../../services/stripe';
import { paymentIntentModel } from '../../../models/payment_intent';
import logger from '../../../utils/logger';
import { createPaymentIntentData, updatePaymentIntentData } from './helper';

export async function createPaymentIntentController(
  req: Request,
  res: Response
) {
  try {
    const { amount, currency } = req.body;
    const result = await createPaymentIntent(amount, currency);
    const paymentIntentData = createPaymentIntentData(result);
    await paymentIntentModel.createPaymentIntent(paymentIntentData);
    return res.json(result);
  } catch (err: any) {
    logger.error(`Failed to create payment intent: ${err.message}`, {
      error: err,
    });
    return res.status(500).json({ error: 'Failed to create payment intent' });
  }
}

export async function confirmPaymentIntentController(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'payment_intent id is required' });
    }

    const result = await confirmPaymentIntent(
      id,
      paymentMethod || 'pm_card_visa'
    );
    const paymentIntentData = updatePaymentIntentData(result);
    await paymentIntentModel.updatePaymentIntent(paymentIntentData);
    return res.json(result);
  } catch (err: any) {
    logger.error(`Failed to confirm payment intent: ${err.message}`, {
      error: err,
    });
    return res.status(500).json({ error: 'Failed to confirm payment intent' });
  }
}
