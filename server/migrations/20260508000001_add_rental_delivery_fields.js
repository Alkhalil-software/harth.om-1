// Add delivery_address (JSONB) and payment_method (text) to rentals
// so rental checkout can collect the same info as purchase checkout.

exports.up = async function (knex) {
  await knex.schema.alterTable("rentals", (t) => {
    t.jsonb("delivery_address");
    t.string("payment_method", 32); // 'card' | 'cash_on_delivery'
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("rentals", (t) => {
    t.dropColumn("delivery_address");
    t.dropColumn("payment_method");
  });
};
