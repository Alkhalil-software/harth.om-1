// 007. Order items. Line items for each order.
// NOTE: we intentionally do NOT add a CHECK like (line_total = price_per_unit * quantity)
// because floating-point rounding can make that constraint fail on valid data.
// The app layer is responsible for computing line_total correctly.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable("order_items", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    t.uuid("order_id")
      .notNullable()
      .references("id")
      .inTable("orders")
      .onDelete("CASCADE"); // delete line items when parent order goes

    t.uuid("equipment_id")
      .notNullable()
      .references("id")
      .inTable("equipment")
      .onDelete("RESTRICT"); // never lose sales history

    // Snapshot of what was sold (name and image at purchase time)
    t.string("equipment_name_snapshot", 200).notNullable();
    t.string("equipment_image_snapshot", 500);

    t.integer("quantity").notNullable();
    t.decimal("price_per_unit", 12, 2).notNullable();
    t.decimal("line_total", 12, 2).notNullable();

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index("order_id");
    t.index("equipment_id");
  });

  await knex.raw(`
    ALTER TABLE order_items ADD CONSTRAINT order_items_qty_positive CHECK (quantity > 0);
  `);
  await knex.raw(`
    ALTER TABLE order_items ADD CONSTRAINT order_items_amounts_nonneg CHECK (
      price_per_unit >= 0 AND line_total >= 0
    );
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("order_items");
};
