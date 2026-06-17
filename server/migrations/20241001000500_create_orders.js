// 006. Orders table. Created after promo_codes so the FK resolves.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable("orders", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("RESTRICT");

    t.uuid("promo_code_id")
      .references("id")
      .inTable("promo_codes")
      .onDelete("SET NULL");

    // Short human-readable tracking code (e.g. HRT-ABC123). Unique.
    t.string("tracking_number", 32).notNullable().unique();

    t.decimal("subtotal", 12, 2).notNullable();
    t.decimal("discount", 12, 2).notNullable().defaultTo(0);
    t.decimal("tax", 12, 2).notNullable().defaultTo(0);
    t.decimal("shipping_fee", 12, 2).notNullable().defaultTo(0);
    t.decimal("loyalty_points_used", 12, 2).notNullable().defaultTo(0);
    t.decimal("total", 12, 2).notNullable();

    // Loyalty points earned on this order (written at payment time)
    t.integer("loyalty_points_earned").notNullable().defaultTo(0);

    t.specificType("status", "order_status").notNullable().defaultTo("pending");
    t.specificType("payment_status", "payment_status")
      .notNullable()
      .defaultTo("pending");

    // Snapshot of delivery address at order time
    t.jsonb("shipping_address").notNullable();

    // Stripe / payment provider references
    t.string("payment_intent_id", 128);
    t.string("payment_method", 32); // card, cash_on_delivery, ...
    t.timestamp("paid_at", { useTz: true });

    t.text("notes");

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index(["user_id", "status"]);
    t.index("tracking_number");
    t.index("payment_status");
    t.index("created_at");
  });

  await knex.raw(`
    ALTER TABLE orders ADD CONSTRAINT orders_amounts_nonneg CHECK (
      subtotal >= 0 AND discount >= 0 AND tax >= 0 AND shipping_fee >= 0
      AND loyalty_points_used >= 0 AND total >= 0
    );
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("orders");
};
