/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('customer_billing_info', function (table) {
    table.string('customer_id').notNullable().primary();
    table.string('email').notNullable();
    table.string('name').nullable();
    table.string('address_line_1').nullable();
    table.string('address_line_2').nullable();
    table.string('city').nullable();
    table.string('state').nullable();
    table.string('postal_code').nullable();
    table.string('country').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('customer_id');
    table.index('email');
    table.index('name');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('customer_billing_info');
};
