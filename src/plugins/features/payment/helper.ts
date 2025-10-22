import { PaymentIntentData } from '../../../models/payment_intent';
import { ConfirmPaymentIntentResult, CreatePaymentIntentResult } from '../../../services/stripe';
export function createPaymentIntentData(result: CreatePaymentIntentResult): PaymentIntentData {
    const paymentIntentData: PaymentIntentData = {
        id: result.id,
        amount: result.amount,
        currency: result.currency,
        status: result.status,
        ...(result.customer ? { customer_id: result.customer } : {}),
        ...(result.description ? { description: result.description } : {}),
        ...(result.metadata ? { metadata: result.metadata } : {}),
        ...(result.client_secret ? { client_secret: result.client_secret } : {}),
        ...(result.created ? { created: result.created } : {}),
        ...(result.payment_method ? { payment_method: result.payment_method } : {}),
    }
    return paymentIntentData;
}

// Helper for update operations
export function updatePaymentIntentData(result: ConfirmPaymentIntentResult): PaymentIntentData {
    const paymentIntentData: PaymentIntentData = {
        id: result.id,
        amount: result.amount,
        currency: result.currency,
        status: result.status,
        ...(result.customer ? { customer_id: result.customer } : {}),
        ...(result.description ? { description: result.description } : {}),
        ...(result.metadata ? { metadata: result.metadata } : {}),
        ...(result.client_secret ? { client_secret: result.client_secret } : {}),
        ...(result.created ? { created: result.created } : {}),
        ...(result.payment_method ? { payment_method: result.payment_method } : {}),
    }
    return paymentIntentData;
}