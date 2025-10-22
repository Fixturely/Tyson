import express from 'express';
import { validateBody } from '../../../middleware/validate';
import { createIntentSchema, confirmSchema } from './validator';
import {
  confirmPaymentIntentController,
  createPaymentIntentController,
} from './controller';

const router = express.Router();

router.post(
  '/payments/intent',
  validateBody(createIntentSchema),
  createPaymentIntentController
);

router.post(
  '/payments/intent/:id/confirm',
  validateBody(confirmSchema),
  confirmPaymentIntentController
);

export default router;
