// 008. Delivery requests. Can be linked to either a rental OR an order (exclusive).

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable("delivery_requests", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    t.uuid("rental_id").references("id").inTable("rentals").onDelete("CASCADE");
    t.uuid("order_id").references("id").inTable("orders").onDelete("CASCADE");

    // The delivery courier who accepted the job (nullable until accepted)
    t.uuid("courier_id")
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");

    t.specificType("status", "delivery_status")
      .notNullable()
      .defaultTo("pending");

    t.jsonb("pickup_address").notNullable(); // { street, city, lat, lng }
    t.jsonb("dropoff_address").notNullable();

    t.date("scheduled_date");
    t.timestamp("accepted_at", { useTz: true });
    t.timestamp("picked_up_at", { useTz: true });
    t.timestamp("delivered_at", { useTz: true });
    t.timestamp("cancelled_at", { useTz: true });

    t.decimal("fee", 10, 2).notNullable().defaultTo(0);
    t.text("notes");

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index("status");
    t.index("courier_id");
    t.index("rental_id");
    t.index("order_id");
  });

  // Exactly one of rental_id / order_id must be set.
  await knex.raw(`
    ALTER TABLE delivery_requests ADD CONSTRAINT delivery_link_xor CHECK (
      (rental_id IS NOT NULL)::int + (order_id IS NOT NULL)::int = 1
    );
  `);
  await knex.raw(`
    ALTER TABLE delivery_requests ADD CONSTRAINT delivery_fee_nonneg CHECK (fee >= 0);
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("delivery_requests");
};
