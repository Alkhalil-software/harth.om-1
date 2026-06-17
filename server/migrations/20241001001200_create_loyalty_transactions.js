// 013. Loyalty points ledger. Replaces the single loyalty_points counter
// as the source of truth — the counter on users is now a cached sum.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE TYPE loyalty_txn_kind AS ENUM (
      'earn',           -- earned from a paid order
      'spend',          -- consumed on an order
      'expire',         -- background sweep removed stale points
      'referral_bonus', -- earned from referring/being referred
      'admin_adjust'    -- manual correction by admin
    );
  `);

  await knex.schema.createTable("loyalty_transactions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    t.specificType("kind", "loyalty_txn_kind").notNullable();

    // Positive for credits, negative for debits. We store the signed value
    // so SUM() gives the user's balance directly.
    t.integer("amount").notNullable();

    // Track the remaining unspent amount of an 'earn' row. 'spend' rows have
    // amount<0 and remaining=0. This lets us implement FIFO consumption and
    // expiry without rewriting history.
    t.integer("remaining").notNullable().defaultTo(0);

    // Earn transactions get an expires_at (one year from creation).
    t.timestamp("expires_at", { useTz: true });

    // Optional link back to whatever caused this transaction.
    t.uuid("order_id").references("id").inTable("orders").onDelete("SET NULL");
    t.uuid("rental_id")
      .references("id")
      .inTable("rentals")
      .onDelete("SET NULL");
    // For referral rewards, the other party involved.
    t.uuid("referred_user_id")
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");

    t.text("notes");

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index(["user_id", "created_at"]);
    t.index(["user_id", "kind"]);
    // Used by the expiry sweep: find credit rows with remaining>0 past expires_at
    t.index(["kind", "expires_at"]);
  });

  // Non-zero amount makes bookkeeping trivially correct.
  await knex.raw(`
    ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_amount_nonzero
    CHECK (amount <> 0);
  `);
  // 'earn'-like rows must have positive amount, 'spend' rows negative.
  await knex.raw(`
    ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_sign_matches_kind
    CHECK (
      (kind IN ('earn','referral_bonus','admin_adjust') AND amount > 0)
      OR (kind IN ('spend','expire') AND amount < 0)
      OR (kind = 'admin_adjust' AND amount < 0)
    );
  `);
  // remaining never exceeds the absolute amount and never negative.
  await knex.raw(`
    ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_remaining_valid
    CHECK (remaining >= 0 AND remaining <= abs(amount));
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("loyalty_transactions");
  await knex.raw(`DROP TYPE IF EXISTS loyalty_txn_kind CASCADE;`);
};
