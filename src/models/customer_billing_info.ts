import db from '../services/database';
import logger from '../utils/logger';
import Stripe from 'stripe';

export type CustomerBillingInfoData = {
  customer_id: string;
  email: string;
  name?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  created_at?: Date;
  updated_at?: Date;
};

export class CustomerBillingInfoModel {
  private buildRecordFromStripe(
    customer: Stripe.Customer
  ): CustomerBillingInfoData {
    return {
      customer_id: customer.id,
      email: customer.email || '',
      name: customer.name || null,
      address_line_1: customer.address?.line1 || null,
      address_line_2: customer.address?.line2 || null,
      city: customer.address?.city || null,
      state: customer.address?.state || null,
      postal_code: customer.address?.postal_code || null,
      country: customer.address?.country || null,
      updated_at: new Date(),
    };
  }
  async createCustomerBillingInfo(
    customerBillingInfoData: CustomerBillingInfoData
  ): Promise<void> {
    try {
      await db('customer_billing_info').insert(customerBillingInfoData);
    } catch (error) {
      logger.error(`Error creating customer billing info: ${error}`);
      throw error;
    }
  }

  // Insert if absent; do NOT overwrite existing data (for payment flows)
  async ensureExistsFromStripe(customer: Stripe.Customer): Promise<void> {
    try {
      const record = this.buildRecordFromStripe(customer);

      await db('customer_billing_info')
        .insert(record)
        .onConflict('customer_id')
        .ignore();
    } catch (error) {
      logger.error(`Error ensuring customer billing info exists: ${error}`);
      throw error;
    }
  }

  // Authoritative update from Stripe (webhook-driven)
  async updateFromStripe(customer: Stripe.Customer): Promise<void> {
    try {
      const record = this.buildRecordFromStripe(customer);
      const { customer_id, ...updateData } = record;

      await db('customer_billing_info')
        .insert(record)
        .onConflict('customer_id')
        .merge(updateData);
    } catch (error) {
      logger.error(
        `Error updating customer billing info from Stripe: ${error}`
      );
      throw error;
    }
  }

  async getCustomerBillingInfoByCustomerId(
    customerId: string
  ): Promise<CustomerBillingInfoData | null> {
    try {
      const result = await db('customer_billing_info')
        .where('customer_id', customerId)
        .first();
      return result as CustomerBillingInfoData | null;
    } catch (error) {
      logger.error(
        `Error getting customer billing info by customer id: ${error}`
      );
      throw error;
    }
  }
}

export const customerBillingInfoModel = new CustomerBillingInfoModel();
