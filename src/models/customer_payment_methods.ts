import { custom } from 'joi';
import db from '../services/database';
import logger from '../utils/logger';
import Stripe from 'stripe';

export interface CustomerPaymentMethodData {
  id?: number;
  customer_id: string; // Stripe cus_...
  payment_method_id: string; // Stripe pm_...
  type: string; // card, us_bank_account, etc.
  card_brand?: string | null;
  card_last4?: string | null;
  card_exp_month?: number | null;
  card_exp_year?: number | null;
  card_funding?: string | null;
  bank_name?: string | null;
  bank_last4?: string | null;
  mandate_id?: string | null;
  is_default?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

function mapStripePaymentMethod(
  pm: Stripe.PaymentMethod,
  customerId?: string
): CustomerPaymentMethodData {
  let determinedCustomerId: string | undefined = customerId;
  if (!determinedCustomerId) {
    if (typeof pm.customer == 'string') {
      determinedCustomerId = pm.customer;
    } else if (pm.customer?.id) {
      determinedCustomerId = pm.customer.id;
    }
  }

  if (!determinedCustomerId) {
    logger.error('Could not determine customer ID for payment method', {
      payment_method_id: pm.id,
    });
    throw new Error(`Customer ID is required to save payment method ${pm.id}`);
  }

  const base: CustomerPaymentMethodData = {
    customer_id: determinedCustomerId,
    payment_method_id: pm.id,
    type: pm.type,
    is_default: false,
  };

  if (pm.type === 'card' && pm.card) {
    base.card_brand = pm.card.brand || null;
    base.card_last4 = pm.card.last4 || null;
    base.card_exp_month = pm.card.exp_month || null;
    base.card_exp_year = pm.card.exp_year || null;
    base.card_funding = pm.card.funding || null;
  }

  // US bank account
  if (pm.type === 'us_bank_account' && pm.us_bank_account) {
    base.bank_name = pm.us_bank_account.bank_name || null;
    base.bank_last4 = pm.us_bank_account.last4 || null;
  }

  // SEPA debit
  if (pm.type === 'sepa_debit' && pm.sepa_debit) {
    base.bank_last4 = pm.sepa_debit.last4 || null;
    base.mandate_id = (pm.sepa_debit as any).mandate || null;
  }

  return base;
}

export class CustomerPaymentMethodsModel {
  async upsertFromStripePaymentMethod(
    pm: Stripe.PaymentMethod,
    customerId?: string
  ): Promise<void> {
    try {
      const record = mapStripePaymentMethod(pm, customerId);
      const { payment_method_id, ...updateData } = record;

      await db('customer_payment_methods')
        .insert(record)
        .onConflict('payment_method_id')
        .merge({ ...updateData, updated_at: new Date() });

      logger.info('Upserted payment method', {
        payment_method_id: pm.id,
        customer_id: record.customer_id,
        type: record.type,
      });
    } catch (error) {
      logger.error(`Error upserting payment method: ${error}`);
      throw error;
    }
  }

  async listByCustomer(
    customerId: string
  ): Promise<CustomerPaymentMethodData[]> {
    try {
      return await db('customer_payment_methods')
        .where('customer_id', customerId)
        .orderBy([
          { column: 'is_default', order: 'desc' },
          { column: 'created_at', order: 'desc' },
        ]);
    } catch (error) {
      logger.error(`Error listing payment methods: ${error}`);
      throw error;
    }
  }

  async remove(paymentMethodId: string): Promise<void> {
    try {
      await db('customer_payment_methods')
        .where('payment_method_id', paymentMethodId)
        .delete();
    } catch (error) {
      logger.error(`Error removing payment method: ${error}`);
      throw error;
    }
  }
}

export const customerPaymentMethodsModel = new CustomerPaymentMethodsModel();
