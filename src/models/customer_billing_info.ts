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

  async upsertFromStripe(customer: Stripe.Customer): Promise<void> {
    try {
      const record: CustomerBillingInfoData = {
        customer_id: customer.id,
        email: customer.email || '',
        name: (customer.name || '') as string,
        address_line_1: customer.address?.line1 || null,
        address_line_2: customer.address?.line2 || null,
        city: customer.address?.city || null,
        state: customer.address?.state || null,
        postal_code: customer.address?.postal_code || null,
        country: customer.address?.country || null,
        updated_at: new Date(),
      };

      // Backwards-compat method: defaults to authoritative merge by customer_id
      await db('customer_billing_info')
        .insert(record)
        .onConflict('customer_id')
        .merge({
          email: record.email,
          name: record.name ?? null,
          address_line_1: record.address_line_1 ?? null,
          address_line_2: record.address_line_2 ?? null,
          city: record.city ?? null,
          state: record.state ?? null,
          postal_code: record.postal_code ?? null,
          country: record.country ?? null,
          updated_at: record.updated_at,
        });
    } catch (error) {
      logger.error(
        `Error upserting customer billing info from Stripe: ${error}`
      );
      throw error;
    }
  }

  // Insert if absent; do NOT overwrite existing data (for payment flows)
  async ensureExistsFromStripe(customer: Stripe.Customer): Promise<void> {
    try {
      const record: CustomerBillingInfoData = {
        customer_id: customer.id,
        email: customer.email || '',
        name: (customer.name || '') as string,
        address_line_1: customer.address?.line1 || null,
        address_line_2: customer.address?.line2 || null,
        city: customer.address?.city || null,
        state: customer.address?.state || null,
        postal_code: customer.address?.postal_code || null,
        country: customer.address?.country || null,
        updated_at: new Date(),
      };

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
      const record: CustomerBillingInfoData = {
        customer_id: customer.id,
        email: customer.email || '',
        name: (customer.name || '') as string,
        address_line_1: customer.address?.line1 || null,
        address_line_2: customer.address?.line2 || null,
        city: customer.address?.city || null,
        state: customer.address?.state || null,
        postal_code: customer.address?.postal_code || null,
        country: customer.address?.country || null,
        updated_at: new Date(),
      };

      await db('customer_billing_info')
        .insert(record)
        .onConflict('customer_id')
        .merge({
          email: record.email,
          name: record.name ?? null,
          address_line_1: record.address_line_1 ?? null,
          address_line_2: record.address_line_2 ?? null,
          city: record.city ?? null,
          state: record.state ?? null,
          postal_code: record.postal_code ?? null,
          country: record.country ?? null,
          updated_at: record.updated_at,
        });
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
