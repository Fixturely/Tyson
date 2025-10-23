import express from 'express';
import { validateBody } from '../../../middleware/validate';
import {
  createIntentSchema,
  confirmSchema,
  zeusSubscriptionSchema,
} from './validator';
import {
  confirmPaymentIntentController,
  createPaymentIntentController,
  createZeusSubscriptionPaymentController,
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

router.post(
  '/billing/subscriptions/payment',
  validateBody(zeusSubscriptionSchema),
  createZeusSubscriptionPaymentController
);

export default router;
