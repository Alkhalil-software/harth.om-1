// Allow admins to hard-delete equipment that has linked orders/rentals.
// order_items and rentals keep their snapshot data; equipment_id becomes NULL.

exports.up = async function (knex) {
  await knex.schema.alterTable("order_items", (t) => {
    t.uuid("equipment_id").nullable().alter();
  });
  await knex.schema.alterTable("rentals", (t) => {
    t.uuid("equipment_id").nullable().alter();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("order_items", (t) => {
    t.uuid("equipment_id").notNullable().alter();
  });
  await knex.schema.alterTable("rentals", (t) => {
    t.uuid("equipment_id").notNullable().alter();
  });
};
