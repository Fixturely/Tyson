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
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('payment_intents');
};
