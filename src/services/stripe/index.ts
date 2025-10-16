import 'dotenv/config';
import Stripe from "stripe";
import config from '../../../config';

const secretKey = config.stripe?.secretKey || process.env.STRIPE_SECRET_KEY || '';
if (!secretKey) {
  throw new Error('STRIPE_SECRET_KEY is missing');
}

const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });

export async function createPaymentIntent(amountCents:number, currency='usd'){
    const pi = await stripe.paymentIntents.create({
        amount: amountCents,
        currency,
        automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never',
        },
    })
    return {id: pi.id, clientSecret: pi.client_secret, status: pi.status}
}

export async function confirmPaymentIntent(paymentIntentId: string, paymentMethod: string = 'pm_card_visa'){
    const confirmed = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethod,
    });
    return { id: confirmed.id, status: confirmed.status };
}