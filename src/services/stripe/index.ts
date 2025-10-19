import 'dotenv/config';
import Stripe from "stripe";
import config from '../../../config';

const secretKey = config.stripe?.secretKey || process.env.STRIPE_SECRET_KEY || '';
if (!secretKey) {
  throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(secretKey, { apiVersion: config.stripe.apiVersion as Stripe.LatestApiVersion });

// Explicit return types for payment intent functions
export interface CreatePaymentIntentResult {
    id: string;
    client_secret: string | null;
    status: string;
  }
  export interface ConfirmPaymentIntentResult {
    id: string;
    status: string;
  }
  

export async function createPaymentIntent(amountCents:number, currency='usd'): Promise<CreatePaymentIntentResult> {
    const pi = await stripe.paymentIntents.create({
        amount: amountCents,
        currency,
        automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never',
        },
    })
    return {id: pi.id, client_secret: pi.client_secret, status: pi.status}
}

export async function confirmPaymentIntent(paymentIntentId: string, paymentMethod: string = 'pm_card_visa'): Promise<ConfirmPaymentIntentResult> {
    const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethod,
    });
    return { id: confirmed.id, status: confirmed.status };
}