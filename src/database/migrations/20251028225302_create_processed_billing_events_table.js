/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('processed_billing_events', function (table) {
    table.increments('id').primary(); // Auto-incrementing primary key
    table.string('event_id').notNullable().unique(); // Stripe Event ID (evt_xxx)
    table.string('event_type').notNullable();
    table.string('payment_intent_id').nullable();
    table.timestamp('processed_at').defaultTo(knex.fn.now());
    table.boolean('success').defaultTo(true);
    table.text('error_message').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Essential indexes
    table.index('event_id');
    table.index('event_type');
    table.index('processed_at');
    table.index('payment_intent_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('processed_billing_events');
};
