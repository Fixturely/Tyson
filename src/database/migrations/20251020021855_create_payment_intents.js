/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('payment_intents', table => {
    table.string('id').primary(); // Stripe PaymentIntent ID (pi_xxxxx)
    table.integer('amount').notNullable(); // Amount in cents
    table.string('currency', 3).notNullable(); // USD, EUR, etc.
    table.string('status').notNullable(); // succeeded, failed, pending, canceled
    table.string('customer_id').nullable(); // Stripe Customer ID
    table.text('description').nullable(); // Payment description
    table.json('metadata').nullable(); // Additional data from Stripe
    table.string('client_secret').nullable(); // For frontend confirmation
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes for common queries
    table.index(['status']);
    table.index(['customer_id']);
    table.index(['created_at']);
    table.index(['currency']);
  }).then(() => {
    // Create trigger to automatically update updated_at timestamp
    return knex.raw(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      CREATE TRIGGER update_payment_intents_updated_at 
        BEFORE UPDATE ON payment_intents 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    `);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    DROP TRIGGER IF EXISTS update_payment_intents_updated_at ON payment_intents;
    DROP FUNCTION IF EXISTS update_updated_at_column();
  `).then(() => {
    return knex.schema.dropTable('payment_intents');
  });
};
