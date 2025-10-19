import express from 'express';
import Stripe from 'stripe';
import logger from '../../../utils/logger';
import config from '../../../../config';
import { idempotencyKeyStore } from '../../../services/idempotency/index';


const router = express.Router();

const stripe = new Stripe(config.stripe.secretKey, { apiVersion: config.stripe.apiVersion as Stripe.LatestApiVersion });

router.post('/', (req: express.Request, res: express.Response) => {
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
    logger.info(`Event constructed: ${event.id}`);
   } catch (error) {
    logger.error(`Error constructing event: ${error}`);
    return res.status(400).json({ error: 'Invalid signature' });
   }

   // Check idempotency
   if(idempotencyKeyStore.hasProcessed(event.id)) {
    logger.info(`Event already processed: ${event.id}`);
    return res.status(200).json({ message: 'Event already processed' });
   }

   try{
    switch(event.type){
        case 'payment_intent.succeeded':
            const paymentIntentSucceeded = event.data.object as Stripe.PaymentIntent;
            logger.info(`Payment intent succeeded: ${paymentIntentSucceeded.id}`);
            // TODO: persist success, fulfill order, notify other services

            break;
        case 'payment_intent.payment_failed':
            const paymentIntentFailed = event.data.object as Stripe.PaymentIntent;
            logger.info(`Payment intent failed: ${paymentIntentFailed.id}`);
            // TODO: handle failed payment, notify user, etc.
            break;
        default:
            logger.info(`Unhandled event type ${event.type}`);
            break;
    }

    // Mark event as processed
    idempotencyKeyStore.markProcessed(event.id);
    return res.status(200).json({ message: 'Webhook received' });
   } catch (error) {
    logger.error(`Error processing event: ${error}`);
    return res.status(500).json({ error: 'Internal server error' });
   }
   
})

export default router;