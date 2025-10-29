import { Request, Response } from 'express';
import {
  confirmPaymentIntent,
  createPaymentIntent,
} from '../../../services/stripe';
import { paymentIntentModel } from '../../../models/payment_intent';
import logger from '../../../utils/logger';
import { createPaymentIntentData, updatePaymentIntentData } from './helper';
import { zeusSubscriptionModel } from '../../../models/zeus_subscriptions';
import { createOrGetStripeCustomer } from '../../../services/stripe';
import { customerBillingInfoModel } from '../../../models/customer_billing_info';

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

export async function createZeusSubscriptionPaymentController(
  req: Request,
  res: Response
) {
  try {
    const {
      subscription_id,
      user_id,
      amount,
      currency,
      description,
      metadata,
      customer_info,
    } = req.body;

    // Create Stripe customer if needed
    const stripeCustomer = await createOrGetStripeCustomer(
      customer_info as { email: string; name?: string }
    );
    // Ensure a billing record exists without overwriting existing data
    await customerBillingInfoModel.ensureExistsFromStripe(stripeCustomer);

    // Create payment intent with customer info
    const result = await createPaymentIntent(amount, currency, {
      customer: stripeCustomer.id,
      description:
        description || 'Zeus Subscription Payment - ' + subscription_id,
      metadata: {
        subscription_id,
        user_id,
        ...metadata,
      },
    });

    const paymentIntentData = createPaymentIntentData(result);
    await paymentIntentModel.createPaymentIntent(paymentIntentData);

    // Create Zeus subscription
    // Store Zeus subscription in database
    await zeusSubscriptionModel.createZeusSubscription({
      subscription_id,
      user_id,
      payment_intent_id: paymentIntentData.id,
      amount,
      currency,
      status: 'pending',
      sport_id: metadata?.sport_id,
      team_id: metadata?.team_id,
      subscription_type: metadata?.subscription_type,
      customer_email: customer_info.email,
      customer_name: customer_info?.name,
    });

    return res.json({
      payment_intent_id: result.id,
      client_secret: result.client_secret,
      status: result.status,
    });
  } catch (err: any) {
    logger.error(`Failed to create Zeus subscription payment: ${err.message}`, {
      error: err,
    });
    return res
      .status(500)
      .json({ error: 'Failed to create Zeus subscription payment' });
  }
}
