// 011. Carts + cart_items. One row per active cart (one per user).
// We use two tables rather than denormalizing so we can attach snapshots,
// quantities, and timestamps per item independently.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable("carts", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("user_id")
      .notNullable()
      .unique() // one active cart per user
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("cart_items", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("cart_id")
      .notNullable()
      .references("id")
      .inTable("carts")
      .onDelete("CASCADE");
    t.uuid("equipment_id")
      .notNullable()
      .references("id")
      .inTable("equipment")
      .onDelete("CASCADE");
    t.integer("quantity").notNullable();
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Prevent duplicate line items in the same cart — merge via quantity.
    t.unique(["cart_id", "equipment_id"]);
    t.index("cart_id");
  });

  await knex.raw(`
    ALTER TABLE cart_items ADD CONSTRAINT cart_items_qty_positive CHECK (quantity > 0);
  `);

  // Attach the shared updated_at trigger to the new tables.
  for (const table of ["carts", "cart_items"]) {
    await knex.raw(`
      DROP TRIGGER IF EXISTS set_${table}_updated_at ON ${table};
      CREATE TRIGGER set_${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    `);
  }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("cart_items");
  await knex.schema.dropTableIfExists("carts");
};
