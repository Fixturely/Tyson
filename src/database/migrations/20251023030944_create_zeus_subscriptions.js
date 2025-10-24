/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('zeus_subscriptions', table => {
      table.increments('id').primary();
      table.integer('subscription_id').unique().notNullable(); // subscription id
      table.integer('user_id').notNullable(); // user id
      table.string('payment_intent_id').notNullable();

      // Zeus business data
      table.integer('sport_id').nullable();
      table.integer('team_id').nullable();
      table.string('subscription_type').nullable();

      // Customer info
      table.string('customer_email').notNullable();
      table.string('customer_name').nullable();

      // Payment tracking
      table.integer('amount').notNullable(); // Amount in cents
      table.string('currency', 3).notNullable().defaultTo('usd');
      table
        .enum('status', ['pending', 'succeeded', 'failed', 'canceled'])
        .notNullable()
        .defaultTo('pending');
      // Timestamps
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('paid_at').nullable();

      // Zeus notification tracking
      table.timestamp('zeus_notified_at').nullable();
      table.integer('zeus_notification_attempts').defaultTo(0);

      // Indexes
      table.index(['subscription_id']);
      table.index(['user_id']);
      table.index(['payment_intent_id']);
      table.index(['status']);

      // Foreign key to payment_intents
      table
        .foreign('payment_intent_id')
        .references('id')
        .inTable('payment_intents');
    })
    .then(() => {
      // Trigger to automatically update updated_at timestamp
      return knex.raw(`
        CREATE OR REPLACE FUNCTION update_zeus_subscriptions_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
        
        CREATE TRIGGER update_zeus_subscriptions_updated_at 
        BEFORE UPDATE ON zeus_subscriptions 
        FOR EACH ROW 
        EXECUTE FUNCTION update_zeus_subscriptions_updated_at();
        `);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex
    .raw(
      `
    DROP TRIGGER IF EXISTS update_zeus_subscriptions_updated_at ON zeus_subscriptions;
    DROP FUNCTION IF EXISTS update_zeus_subscriptions_updated_at();
    `
    )
    .then(() => {
      return knex.schema.dropTable('zeus_subscriptions');
    });
};
