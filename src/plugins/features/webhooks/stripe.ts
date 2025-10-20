import express from 'express';
import Stripe from 'stripe';
import logger from '../../../utils/logger';
import config from '../../../../config';
import { idempotencyKeyStore } from '../../../services/idempotency/index';
import { webhookEventDbService } from '../../../services/webhooks/db';


const router = express.Router();

const stripe = new Stripe(config.stripe.secretKey, { apiVersion: config.stripe.apiVersion as Stripe.LatestApiVersion });

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
   try{
    event=stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
   } catch (error) {
    logger.error(`Error constructing event: ${error}`);
    return res.status(400).json({ error: 'Invalid signature' });
   }

   // Check idempotency
   if(idempotencyKeyStore.hasProcessed(event.id)) {
    logger.info(`Event already processed: ${event.id}`);
    return res.status(200).json({ message: 'Event already processed' });
   }

    // Store webhook event in database
  try {
    const dataObject = event.data.object as any;
    await webhookEventDbService.createWebhookEvent({
      id: event.id,
      type: event.type,
      payment_intent_id: dataObject.object === 'payment_intent' ? dataObject.id : dataObject.payment_intent,
      data: event.data.object,
      processed: false,
    });
  } catch (error) {
    logger.error('Failed to store webhook event', { eventId: event.id, error });
    // Continue processing even if storage fails
  }

   try{
    switch(event.type){
        // Payment Intent Events
        case 'payment_intent.created':
            const paymentIntentCreated = event.data.object as Stripe.PaymentIntent;
            logger.info('Payment intent created', { 
                id: paymentIntentCreated.id,
                amount: paymentIntentCreated.amount,
                currency: paymentIntentCreated.currency,
                status: paymentIntentCreated.status
            });
            // TODO: Store PaymentIntent in database
            break;

        case 'payment_intent.succeeded':
            const paymentIntentSucceeded = event.data.object as Stripe.PaymentIntent;
            logger.info('Payment intent succeeded', { 
                id: paymentIntentSucceeded.id,
                amount: paymentIntentSucceeded.amount,
                currency: paymentIntentSucceeded.currency
            });
            // TODO: Update PaymentIntent status, fulfill order, send confirmation
            break;

        case 'payment_intent.payment_failed':
            const paymentIntentFailed = event.data.object as Stripe.PaymentIntent;
            logger.warn('Payment intent failed', { 
                id: paymentIntentFailed.id,
                error: paymentIntentFailed.last_payment_error?.message,
                code: paymentIntentFailed.last_payment_error?.code
            });
            // TODO: Update PaymentIntent status, notify user, retry logic
            break;

        case 'payment_intent.canceled':
            const paymentIntentCanceled = event.data.object as Stripe.PaymentIntent;
            logger.info('Payment intent canceled', { 
                id: paymentIntentCanceled.id,
                reason: paymentIntentCanceled.cancellation_reason
            });
            // TODO: Update PaymentIntent status, handle cancellation
            break;

        // Charge Events
        case 'charge.succeeded':
            const chargeSucceeded = event.data.object as Stripe.Charge;
            logger.info('Charge succeeded', { 
                id: chargeSucceeded.id,
                amount: chargeSucceeded.amount,
                currency: chargeSucceeded.currency,
                payment_intent: chargeSucceeded.payment_intent
            });
            // TODO: Update accounting records, send receipt
            break;

        case 'charge.failed':
            const chargeFailed = event.data.object as Stripe.Charge;
            logger.warn('Charge failed', { 
                id: chargeFailed.id,
                failure_code: chargeFailed.failure_code,
                failure_message: chargeFailed.failure_message
            });
            // TODO: Handle charge failure, notify user
            break;

        case 'charge.dispute.created':
            const disputeCreated = event.data.object as Stripe.Dispute;
            logger.warn('Charge dispute created', { 
                id: disputeCreated.id,
                amount: disputeCreated.amount,
                reason: disputeCreated.reason,
                charge: disputeCreated.charge
            });
            // TODO: Handle dispute, notify team, gather evidence
            break;

        // Customer Events
        case 'customer.created':
            const customerCreated = event.data.object as Stripe.Customer;
            logger.info('Customer created', { 
                id: customerCreated.id,
                email: customerCreated.email
            });
            // TODO: Store customer in database
            break;

        case 'customer.updated':
            const customerUpdated = event.data.object as Stripe.Customer;
            logger.info('Customer updated', { 
                id: customerUpdated.id,
                email: customerUpdated.email
            });
            // TODO: Update customer in database
            break;

        // Subscription Events (for future use)
        case 'customer.subscription.created':
            const subscriptionCreated = event.data.object as Stripe.Subscription;
            logger.info('Subscription created', { 
                id: subscriptionCreated.id,
                customer: subscriptionCreated.customer,
                status: subscriptionCreated.status
            });
            // TODO: Store subscription, activate service
            break;

        case 'customer.subscription.updated':
            const subscriptionUpdated = event.data.object as Stripe.Subscription;
            logger.info('Subscription updated', { 
                id: subscriptionUpdated.id,
                status: subscriptionUpdated.status,
                current_period_end: subscriptionUpdated.current_period_end
            });
            // TODO: Update subscription, handle plan changes
            break;

        case 'customer.subscription.deleted':
            const subscriptionDeleted = event.data.object as Stripe.Subscription;
            logger.info('Subscription canceled', { 
                id: subscriptionDeleted.id,
                canceled_at: subscriptionDeleted.canceled_at
            });
            // TODO: Cancel subscription, deactivate service
            break;

        // Invoice Events
        case 'invoice.payment_succeeded':
            const invoicePaymentSucceeded = event.data.object as Stripe.Invoice;
            logger.info('Invoice payment succeeded', { 
                id: invoicePaymentSucceeded.id,
                amount_paid: invoicePaymentSucceeded.amount_paid,
                subscription: invoicePaymentSucceeded.subscription
            });
            // TODO: Update subscription status, extend service
            break;

        case 'invoice.payment_failed':
            const invoicePaymentFailed = event.data.object as Stripe.Invoice;
            logger.warn('Invoice payment failed', { 
                id: invoicePaymentFailed.id,
                amount_due: invoicePaymentFailed.amount_due,
                subscription: invoicePaymentFailed.subscription
            });
            // TODO: Handle failed subscription payment, send dunning emails
            break;

        // Refund Events
        case 'charge.refunded':
            const chargeRefunded = event.data.object as Stripe.Charge;
            logger.info('Charge refunded', { 
                id: chargeRefunded.id,
                amount_refunded: chargeRefunded.amount_refunded,
                refunds: chargeRefunded.refunds?.data?.length
            });
            // TODO: Update refund status, process refund
            break;

        // Default case for unhandled events
        default:
            logger.info('Unhandled event type', { 
                type: event.type,
                eventId: event.id
            });
            break;
    }

    // Mark event as processed
    await webhookEventDbService.markWebhookEventAsProcessed(event.id);
    idempotencyKeyStore.markProcessed(event.id);
    return res.status(200).json({ message: 'Webhook received' });
   } catch (error) {
    logger.error(`Error processing event: ${error}`);
    await webhookEventDbService.markWebhookEventAsProcessed(event.id, error instanceof Error ? error.message : 'Unknown error');

    return res.status(500).json({ error: 'Internal server error' });
   }
   
})

// Stats endpoint for monitoring
router.get('/stats', (req, res) => {
  try {
    const stats = idempotencyKeyStore.getStats();
    res.json({
      idempotency: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get webhook stats', { error });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;