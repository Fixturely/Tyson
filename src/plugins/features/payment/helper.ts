import { PaymentIntentData } from '../../../models/payment_intent';
import { ConfirmPaymentIntentResult, CreatePaymentIntentResult } from '../../../services/stripe';
export function createPaymentIntentData(result: CreatePaymentIntentResult): PaymentIntentData {
    const paymentIntentData: any = {
        id: result.id,
        amount: result.amount,
        currency: result.currency,
        status: result.status,
    };
    
    // Only add optional fields if they exist
    if (result.customer) paymentIntentData.customer_id = result.customer;
    if (result.description) paymentIntentData.description = result.description;
    if (result.metadata) paymentIntentData.metadata = result.metadata;
    if (result.client_secret) paymentIntentData.client_secret = result.client_secret;
    if (result.created) paymentIntentData.created = result.created;
    if (result.payment_method) paymentIntentData.payment_method = result.payment_method;
    
    return paymentIntentData;
}

// Helper for update operations
export function updatePaymentIntentData(result: ConfirmPaymentIntentResult): PaymentIntentData {
    const paymentIntentData: any = {
        id: result.id,
        amount: result.amount,
        currency: result.currency,
        status: result.status,
    };
    
    // Only add optional fields if they exist
    if (result.customer) paymentIntentData.customer_id = result.customer;
    if (result.description) paymentIntentData.description = result.description;
    if (result.metadata) paymentIntentData.metadata = result.metadata;
    if (result.client_secret) paymentIntentData.client_secret = result.client_secret;
    if (result.created) paymentIntentData.created = result.created;
    if (result.payment_method) paymentIntentData.payment_method = result.payment_method;
    
    return paymentIntentData;
}