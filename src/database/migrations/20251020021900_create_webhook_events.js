/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('webhook_events', table => {
    table.string('id').primary(); // Stripe Event ID (evt_xxxxx)
    table.string('type').notNullable(); // payment_intent.succeeded, etc.
    table.string('payment_intent_id').nullable(); // Related PaymentIntent ID
    table.json('data').notNullable(); // Full event data from Stripe
    table.boolean('processed').defaultTo(false); // Whether we've processed this event
    table.text('processing_error').nullable(); // Error message if processing failed
    table.timestamp('received_at').defaultTo(knex.fn.now());
    table.timestamp('processed_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes for common queries
    table.index(['type']);
    table.index(['payment_intent_id']);
    table.index(['processed']);
    table.index(['received_at']);
    table.index(['created_at']);
    
    // Note: No foreign key constraint to allow webhook events for PaymentIntents not in our system
  }).then(() => {
    // Create trigger to automatically update updated_at timestamp
    return knex.raw(`
      CREATE OR REPLACE FUNCTION update_webhook_events_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      CREATE TRIGGER update_webhook_events_updated_at 
        BEFORE UPDATE ON webhook_events 
        FOR EACH ROW 
        EXECUTE FUNCTION update_webhook_events_updated_at();
    `);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.raw(`
    DROP TRIGGER IF EXISTS update_webhook_events_updated_at ON webhook_events;
    DROP FUNCTION IF EXISTS update_webhook_events_updated_at();
  `).then(() => {
    return knex.schema.dropTable('webhook_events');
  });
};
