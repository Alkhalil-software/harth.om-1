// 016. Commission ledger. One row per earned commission on a completed
// order/rental. Supports payout tracking (pending -> paid).

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE TYPE commission_status AS ENUM ('pending', 'paid', 'cancelled');
  `);

  await knex.schema.createTable("commission_transactions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    // The seller/owner who earned the revenue this commission was taken from.
    t.uuid("owner_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("RESTRICT");

    // Exactly one source: an order line or a rental. XOR enforced below.
    t.uuid("order_id").references("id").inTable("orders").onDelete("SET NULL");
    t.uuid("rental_id")
      .references("id")
      .inTable("rentals")
      .onDelete("SET NULL");
    t.uuid("order_item_id")
      .references("id")
      .inTable("order_items")
      .onDelete("SET NULL");

    // Snapshot the rate that applied at the time of computation so later
    // rate changes don't mutate historical commissions.
    t.decimal("rate", 5, 4).notNullable(); // 0.1000 = 10%, 0.0500 = 5%

    // Gross amount the owner sold for (pre-commission).
    t.decimal("gross_amount", 12, 2).notNullable();

    // Commission taken by the platform.
    t.decimal("commission_amount", 12, 2).notNullable();

    // Net paid to the owner (gross - commission).
    t.decimal("net_amount", 12, 2).notNullable();

    t.boolean("was_pro_at_time").notNullable().defaultTo(false);

    t.specificType("status", "commission_status")
      .notNullable()
      .defaultTo("pending");

    t.timestamp("paid_at", { useTz: true });
    t.text("notes");

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index(["owner_id", "status"]);
    t.index("order_id");
    t.index("rental_id");
  });

  // Exactly one of (order_item_id, rental_id) must be set.
  await knex.raw(`
    ALTER TABLE commission_transactions
    ADD CONSTRAINT commission_link_xor
    CHECK (
      (order_item_id IS NOT NULL AND rental_id IS NULL)
      OR (rental_id IS NOT NULL AND order_item_id IS NULL)
    );
  `);

  // Amounts non-negative and internally consistent.
  await knex.raw(`
    ALTER TABLE commission_transactions
    ADD CONSTRAINT commission_amounts_valid CHECK (
      gross_amount >= 0 AND commission_amount >= 0 AND net_amount >= 0
      AND rate >= 0 AND rate <= 1
    );
  `);

  // Prevent duplicate commissions for the same order item / rental.
  await knex.raw(`
    CREATE UNIQUE INDEX commission_unique_per_order_item
    ON commission_transactions (order_item_id)
    WHERE order_item_id IS NOT NULL;
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX commission_unique_per_rental
    ON commission_transactions (rental_id)
    WHERE rental_id IS NOT NULL;
  `);

  // Attach the shared updated_at trigger
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_commission_transactions_updated_at ON commission_transactions;
    CREATE TRIGGER set_commission_transactions_updated_at
    BEFORE UPDATE ON commission_transactions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("commission_transactions");
  await knex.raw(`DROP TYPE IF EXISTS commission_status CASCADE;`);
};
