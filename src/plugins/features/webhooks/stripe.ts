import express from 'express';
import Stripe from 'stripe';
import logger from '../../../utils/logger';
import config from '../../../../config';
import { idempotencyKeyStore } from '../../../services/idempotency/index';
import { webhookEventDbService } from '../../../models/webhook_events';
import { customerBillingInfoModel } from '../../../models/customer_billing_info';
import { customerPaymentMethodsModel } from '../../../models/customer_payment_methods';
import { paymentsService } from '../../../services/payments';

const router = express.Router();

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: config.stripe.apiVersion as Stripe.LatestApiVersion,
});

router.post('/', async (req: express.Request, res: express.Response) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig) {
    logger.error('Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }
  const webhookSecret = config.stripe.webhookSecret;
  if (!webhookSecret) {
    logger.error('Missing webhook secret');
    return res.status(500).json({ error: 'Internal server error' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (error) {
    logger.error(`Error constructing event: ${error}`);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Extract payment intent ID early for tracking
  const dataObject = event.data.object as any;
  const paymentIntentId =
    dataObject.object === 'payment_intent'
      ? dataObject.id
      : dataObject.payment_intent;

  // Check idempotency (fast duplicate detection)
  if (await idempotencyKeyStore.hasProcessed(event.id)) {
    logger.info(`Event already processed: ${event.id}`);
    return res.status(200).json({ message: 'Event already processed' });
  }

  // Store webhook event in database (for audit trail and retry logic)
  try {
    await webhookEventDbService.createWebhookEvent({
      id: event.id,
      type: event.type,
      payment_intent_id: paymentIntentId,
      data: event.data.object,
      processed: false,
    });
  } catch (error: any) {
    // If webhook_events table has duplicate, that's okay - we also check idempotency
    if (
      error?.code === '23505' ||
      error?.constraint === 'webhook_events_pkey'
    ) {
      logger.warn('Webhook event already in audit table', {
        eventId: event.id,
      });
      // Note: This shouldn't happen if idempotency is working, but log it
    } else {
      logger.error('Failed to store webhook event in audit table', {
        eventId: event.id,
        error,
      });
      // Continue processing - audit trail failure shouldn't stop webhook
    }
  }

  try {
    var pi: Stripe.PaymentIntent;
    var charge: Stripe.Charge;
    switch (event.type) {
      // Payment Intent Events
      case 'payment_intent.created': {
        pi = event.data.object as Stripe.PaymentIntent;
        await paymentsService.handlePaymentIntentCreated(pi);
        break;
      }

      case 'payment_intent.succeeded': {
        pi = event.data
          .object as Stripe.PaymentIntent;
        await paymentsService.handlePaymentIntentSucceeded(
          pi
        );
        break;
      }

      case 'payment_intent.payment_failed': {
        pi = event.data.object as Stripe.PaymentIntent;
        await paymentsService.handlePaymentIntentFailed(pi);
        break;
      }

      case 'payment_intent.canceled': {
        pi = event.data.object as Stripe.PaymentIntent;
        await paymentsService.handlePaymentIntentCanceled(pi);
        break;
      }

      // Charge Events
      case 'charge.succeeded':
        charge = event.data.object as Stripe.Charge;
        logger.info('Charge succeeded', {
          id: charge.id,
          amount: charge.amount,
          currency: charge.currency,
          payment_intent: charge.payment_intent,
        });
        // TODO: Update accounting records, send receipt
        break;

      case 'charge.failed':
        charge = event.data.object as Stripe.Charge;
        logger.warn('Charge failed', {
          id: charge.id,
          failure_code: charge.failure_code,
          failure_message: charge.failure_message,
        });
        // TODO: Handle charge failure, notify user
        break;


      // Customer Events
      case 'customer.created':
        const customerCreated = event.data.object as Stripe.Customer;
        logger.info('Customer created', {
          id: customerCreated.id,
          email: customerCreated.email,
        });
        // Authoritative write from Stripe: create or update billing info
        await customerBillingInfoModel.updateFromStripe(customerCreated);
        break;

      case 'customer.updated':
        const customerUpdated = event.data.object as Stripe.Customer;
        logger.info('Customer updated', {
          id: customerUpdated.id,
          email: customerUpdated.email,
        });
        // Authoritative write from Stripe: merge latest billing info
        await customerBillingInfoModel.updateFromStripe(customerUpdated);
        break;

      // Subscription Events (for future use)
      case 'customer.subscription.created':
        const subscriptionCreated = event.data.object as Stripe.Subscription;
        logger.info('Subscription created', {
          id: subscriptionCreated.id,
          customer: subscriptionCreated.customer,
          status: subscriptionCreated.status,
        });
        // TODO: Store subscription, activate service
        break;

      case 'customer.subscription.updated':
        const subscriptionUpdated = event.data.object as Stripe.Subscription;
        logger.info('Subscription updated', {
          id: subscriptionUpdated.id,
          status: subscriptionUpdated.status,
          current_period_end: subscriptionUpdated.current_period_end,
        });
        // TODO: Update subscription, handle plan changes
        break;

      case 'customer.subscription.deleted':
        const subscriptionDeleted = event.data.object as Stripe.Subscription;
        logger.info('Subscription canceled', {
          id: subscriptionDeleted.id,
          canceled_at: subscriptionDeleted.canceled_at,
        });
        // TODO: Cancel subscription, deactivate service
        break;

      // Invoice Events
      case 'invoice.payment_succeeded':
        const invoicePaymentSucceeded = event.data.object as Stripe.Invoice;
        logger.info('Invoice payment succeeded', {
          id: invoicePaymentSucceeded.id,
          amount_paid: invoicePaymentSucceeded.amount_paid,
          subscription: invoicePaymentSucceeded.subscription,
        });
        // TODO: Update subscription status, extend service
        break;

      // Payment Method / SetupIntent Events
      case 'setup_intent.succeeded': {
        const si = event.data.object as Stripe.SetupIntent;
        logger.info('SetupIntent succeeded', {
          id: si.id,
          customer: si.customer,
          payment_method: si.payment_method,
        });
        if (si.payment_method) {
          const pmId =
            typeof si.payment_method === 'string'
              ? si.payment_method
              : si.payment_method.id;
          const pm = await stripe.paymentMethods.retrieve(pmId);
          const customerId =
            typeof si.customer === 'string'
              ? si.customer
              : (si.customer as Stripe.Customer)?.id;
          if (customerId) {
            await customerPaymentMethodsModel.upsertFromStripePaymentMethod(
              pm,
              customerId
            );
          } else {
            logger.warn(
              'SetupIntent succeeded but no customer ID found, cannot save payment method',
              { setup_intent_id: si.id }
            );
            return res.status(500).json({ error: 'Internal server error' });
          }
        }
        break;
      }

      case 'payment_method.attached': {
        const pm = event.data.object as Stripe.PaymentMethod;
        logger.info('Payment method attached', {
          id: pm.id,
          customer: pm.customer,
          type: pm.type,
        });
        // Do not persist on generic attach; we only save when a PI succeeds
        // with metadata.save_payment_method=true
        break;
      }

      case 'payment_method.detached': {
        const pm = event.data.object as Stripe.PaymentMethod;
        logger.info('Payment method detached', {
          id: pm.id,
          customer: pm.customer,
          type: pm.type,
        });
        // Remove local record
        await customerPaymentMethodsModel.remove(pm.id);
        break;
      }

      case 'invoice.payment_failed':
        const invoicePaymentFailed = event.data.object as Stripe.Invoice;
        logger.warn('Invoice payment failed', {
          id: invoicePaymentFailed.id,
          amount_due: invoicePaymentFailed.amount_due,
          subscription: invoicePaymentFailed.subscription,
        });
        // TODO: Handle failed subscription payment, send dunning emails
        break;

      // Refund Events
      case 'charge.refunded':
        const chargeRefunded = event.data.object as Stripe.Charge;
        logger.info('Charge refunded', {
          id: chargeRefunded.id,
          amount_refunded: chargeRefunded.amount_refunded,
          refunds: chargeRefunded.refunds?.data?.length,
        });
        // TODO: Update refund status, process refund
        break;

      // Default case for unhandled events
      default:
        logger.info('Unhandled event type', {
          type: event.type,
          eventId: event.id,
        });
        break;
    }

    // Mark event as processed (audit trail)
    await webhookEventDbService.markWebhookEventAsProcessed(event.id);

    // Mark as idempotent (prevents future duplicates)
    await idempotencyKeyStore.markProcessed(event.id, event.type, {
      payment_intent_id: paymentIntentId,
      success: true,
    });

    return res.status(200).json({ message: 'Webhook received' });
  } catch (error) {
    logger.error(`Error processing event: ${error}`);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    try {
      // Mark in audit trail as failed
      await webhookEventDbService.markWebhookEventAsProcessed(
        event.id,
        errorMessage
      );

      // Mark as idempotent so we don't retry automatically
      await idempotencyKeyStore.markProcessed(event.id, event.type, {
        payment_intent_id: paymentIntentId,
        success: false,
        error: errorMessage,
      });
    } catch (markingError) {
      logger.error('Failed to mark event as processed after an error', {
        originalError: error,
        markingError,
        eventId: event.id,
      });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Stats endpoint for monitoring
router.get('/stats', async (req, res) => {
  try {
    const stats = await idempotencyKeyStore.getStats();
    res.json({
      idempotency: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get webhook stats', { error });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
