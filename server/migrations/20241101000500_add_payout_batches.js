// 024. Payout batches — the bookkeeping for paying farmers their net
// earnings.
//
// Today, when an order is delivered or a rental completes, we write one
// row to `commission_transactions` (status='pending'). The owner's
// pending balance = sum(net_amount) over all their commissions in
// pending state.
//
// "Pay Now" creates a single payout_batch that:
//   - belongs to one owner
//   - bundles N pending commission rows together
//   - records the total net amount paid out
//   - records HOW it was paid (bank/cash/wallet) and a reference number
//     so the operator can reconcile against the bank statement
//
// Each commission flips pending → paid atomically inside the same
// transaction that creates the batch. We snapshot the link in
// `payout_batch_items` so the batch retains the line-by-line breakdown
// even if commissions are later cancelled or amended.
//
// Why a batch instead of just stamping `paid_at` on each commission?
//   - One bank transfer often covers many commissions. Without the batch
//     the operator would have to chase 27 separate "paid_at" rows in the
//     same minute to reconcile a single transfer.
//   - The batch carries the actual transfer metadata (method, ref).
//     Putting that on each commission would denormalize.
//   - It mirrors how real payment-rail providers (Stripe Connect, Wise)
//     model payouts.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE TYPE payout_method AS ENUM (
      'bank_transfer',
      'cash',
      'wallet',
      'other'
    );
  `);
  await knex.raw(`
    CREATE TYPE payout_status AS ENUM (
      'paid',
      'cancelled'
    );
  `);

  await knex.schema.createTable("payout_batches", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    // The farmer being paid.
    t.uuid("owner_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("RESTRICT");

    // Total net amount across all commission rows in this batch.
    // Snapshotted at batch-creation time so later amendments to
    // commission_transactions don't desync the batch.
    t.decimal("total_amount", 14, 2).notNullable();

    // How many commission rows were rolled up.
    t.integer("transaction_count").notNullable().defaultTo(0);

    t.specificType("method", "payout_method").notNullable().defaultTo("bank_transfer");

    // External reference: bank receipt number, transfer id, etc.
    t.string("reference", 200);

    t.specificType("status", "payout_status").notNullable().defaultTo("paid");

    t.text("notes");

    // Who clicked "Pay Now"? Always an admin.
    t.uuid("paid_by_admin_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("RESTRICT");

    t.timestamp("paid_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index("owner_id");
    t.index("status");
    t.index("paid_at");
  });

  // total_amount must be positive — empty batches make no sense.
  await knex.raw(`
    ALTER TABLE payout_batches
    ADD CONSTRAINT payout_batches_amount_positive
    CHECK (total_amount > 0 AND transaction_count > 0);
  `);

  // Line items: one row per commission rolled into the batch.
  await knex.schema.createTable("payout_batch_items", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    t.uuid("batch_id")
      .notNullable()
      .references("id")
      .inTable("payout_batches")
      .onDelete("CASCADE");

    t.uuid("commission_id")
      .notNullable()
      .references("id")
      .inTable("commission_transactions")
      .onDelete("RESTRICT");

    // Snapshot of the net amount at the time of batching.
    t.decimal("net_amount", 12, 2).notNullable();

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index("batch_id");
    // A commission can only be in ONE batch — once paid, it's paid.
    t.unique("commission_id");
  });

  // Trigger for updated_at on payout_batches (the existing
  // trigger_set_updated_at function from migration 001 is reused).
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_payout_batches_updated_at ON payout_batches;
    CREATE TRIGGER set_payout_batches_updated_at
    BEFORE UPDATE ON payout_batches
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("payout_batch_items");
  await knex.schema.dropTableIfExists("payout_batches");
  await knex.raw(`DROP TYPE IF EXISTS payout_status CASCADE;`);
  await knex.raw(`DROP TYPE IF EXISTS payout_method CASCADE;`);
};
