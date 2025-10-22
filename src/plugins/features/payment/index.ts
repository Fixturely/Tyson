import express from 'express';
import { confirmPaymentIntent } from '../../../services/stripe';
import logger from '../../../utils/logger';
import { validateBody } from '../../../middleware/validate';
import { createIntentSchema, confirmSchema } from './validator';
import { paymentIntentModel } from '../../../models/payment_intent';
import { confirmPaymentIntentController, createPaymentIntentController } from './controller';
import { updatePaymentIntentData } from './helper';

const router = express.Router();

  router.post('/payments/intent', validateBody(createIntentSchema), createPaymentIntentController);

  router.post('/payments/intent/:id/confirm', validateBody(confirmSchema), confirmPaymentIntentController);

  export default router;