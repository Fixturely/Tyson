import db from '../services/database';
import logger from '../utils/logger';
export type PaymentIntentData = {
    id: string;
    amount: number;
    currency: string;
    status: string;
    customer_id?: string;
    description?: string;
    metadata?: any;
    client_secret?: string;
    created?: number;
    payment_method?: string;
}

export type CreatePaymentIntentData = {
    amount: number;
    currency: string;
    customer_id?: string;
    description?: string;
    metadata?: any;
}

export class PaymentIntentModel {
    async createPaymentIntent(paymentIntentData: PaymentIntentData): Promise<void> {
        try {
            await db('payment_intents').insert(paymentIntentData);
            logger.info(`Payment intent created: ${paymentIntentData.id}`);
        } catch (error) {
            logger.error(`Error creating payment intent: ${error}`);
            throw error;
        }
    }
    async updatePaymentIntent(paymentIntentData: PaymentIntentData): Promise<void> {
        try {
            await db('payment_intents').where('id', paymentIntentData.id).update(paymentIntentData);
            logger.info(`Payment intent updated: ${paymentIntentData.id}`);
        } catch (error) {
            logger.error(`Error updating payment intent: ${error}`);
            throw error;
        }
    }

    async getPaymentIntentById(paymentIntentId: string): Promise<PaymentIntentData | null> {
        try {
            const result = await db('payment_intents').where('id', paymentIntentId).first();
            return result || null;
        } catch (error) {
            logger.error(`Error getting payment intent by id: ${error}`);
            throw error;
        }
    }

    async getPaymentIntentsByCustomer(customerId: string, limit: number = 50, offset: number = 0): Promise<PaymentIntentData[]> {
        try {
            const results = await db('payment_intents')
                .where('customer_id', customerId)
                .orderBy('created_at', 'desc')
                .limit(limit)
                .offset(offset);
            return results;
        } catch (error) {
            logger.error(`Error getting payment intents by customer: ${error}`);
            throw error;
        }
    }

    async getPaymentIntentsByStatus(status: string, limit: number = 50, offset: number = 0): Promise<PaymentIntentData[]> {
        try {
            const results = await db('payment_intents')
                .where('status', status)
                .orderBy('created_at', 'desc')
                .limit(limit)
                .offset(offset);
            return results;
        } catch (error) {
            logger.error(`Error getting payment intents by status: ${error}`);
            throw error;
        }
    }

    async getAllPaymentIntents(limit: number = 50, offset: number = 0): Promise<PaymentIntentData[]> {
        try {
            const results = await db('payment_intents')
                .orderBy('created_at', 'desc')
                .limit(limit)
                .offset(offset);
            return results;
        } catch (error) {
            logger.error(`Error getting all payment intents: ${error}`);
            throw error;
        }
    }

}

export const paymentIntentModel = new PaymentIntentModel();