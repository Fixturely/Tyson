/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('payment_intents', table => {
    table.bigInteger('created').nullable().comment('Stripe created timestamp');
    table.string('payment_method').nullable().comment('Payment method ID');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('payment_intents', table => {
    table.dropColumn('created');
    table.dropColumn('payment_method');
  });
};
