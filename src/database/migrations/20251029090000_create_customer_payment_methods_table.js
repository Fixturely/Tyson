/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('customer_payment_methods', table => {
    table.increments('id').primary();
    table.string('customer_id').notNullable(); // Stripe cus_...
    table.string('payment_method_id').notNullable().unique(); // Stripe pm_...
    table.string('type').notNullable(); // card, us_bank_account, sepa_debit, etc.

    // Card fields (safe metadata only)
    table.string('card_brand').nullable();
    table.string('card_last4', 4).nullable();
    table.integer('card_exp_month').nullable();
    table.integer('card_exp_year').nullable();
    table.string('card_funding').nullable();

    // Bank fields (safe metadata only)
    table.string('bank_name').nullable();
    table.string('bank_last4', 4).nullable();
    table.string('mandate_id').nullable();

    // Management
    table.boolean('is_default').notNullable().defaultTo(false);

    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['customer_id']);
    table.index(['type']);
    table.index(['is_default']);
  }).then(() => {
    return knex.raw(`
      CREATE OR REPLACE FUNCTION update_customer_payment_methods_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER update_customer_payment_methods_updated_at 
      BEFORE UPDATE ON customer_payment_methods 
      FOR EACH ROW 
      EXECUTE FUNCTION update_customer_payment_methods_updated_at();
    `);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.raw(`
    DROP TRIGGER IF EXISTS update_customer_payment_methods_updated_at ON customer_payment_methods;
    DROP FUNCTION IF EXISTS update_customer_payment_methods_updated_at();
  `).then(() => knex.schema.dropTable('customer_payment_methods'));
};



