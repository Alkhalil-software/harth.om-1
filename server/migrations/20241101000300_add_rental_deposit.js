// 022. Security deposit (تأمين/تأمين تالف) for high-value rentals.
//
// A deposit is an extra amount on top of the rental fee that:
//   - is HELD when the rental starts
//   - is REFUNDED to the renter when the equipment is returned in good shape
//   - is FORFEITED (kept by the owner) if the equipment is damaged or lost
//   - can be PARTIAL — owner refunds part and keeps the rest with notes
//
// We don't actually move money here — the platform is still in pre-payment-
// rails state for rentals. What we DO is record the agreed deposit amount,
// snapshot it on each rental at booking time so later edits to the listing
// don't change historical contracts, and track its lifecycle with status +
// admin-visible notes. When the payments rail is wired up later, the
// "held" → "refunded/forfeited" transitions will trigger the actual
// Stripe authorisation reversal or capture.
//
// Schema:
//   equipment.deposit_amount        decimal(12,2)  NULL → no deposit required
//   rentals.deposit_amount          snapshot of the agreed deposit at booking
//   rentals.deposit_status          ENUM (none | held | refunded | forfeited | partial)
//   rentals.deposit_kept_amount     amount the owner kept (for 'partial' / 'forfeited')
//   rentals.deposit_resolved_at     when the owner closed the deposit
//   rentals.deposit_resolved_by     which user closed it (owner or admin)
//   rentals.deposit_notes           admin/owner-visible reason text

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE TYPE deposit_status AS ENUM (
      'none',
      'held',
      'refunded',
      'forfeited',
      'partial'
    );
  `);

  // 1. Equipment listing: optional deposit amount.
  await knex.schema.alterTable("equipment", (t) => {
    t.decimal("deposit_amount", 12, 2);
  });
  await knex.raw(`
    ALTER TABLE equipment ADD CONSTRAINT equipment_deposit_nonneg
    CHECK (deposit_amount IS NULL OR deposit_amount >= 0);
  `);

  // 2. Rentals: snapshot + status + audit fields.
  await knex.schema.alterTable("rentals", (t) => {
    t.decimal("deposit_amount", 12, 2).notNullable().defaultTo(0);
    t.specificType("deposit_status", "deposit_status")
      .notNullable()
      .defaultTo("none");
    t.decimal("deposit_kept_amount", 12, 2).notNullable().defaultTo(0);
    t.timestamp("deposit_resolved_at", { useTz: true });
    t.uuid("deposit_resolved_by")
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    t.text("deposit_notes");

    t.index("deposit_status");
  });

  // The amounts must make sense:
  //   deposit_amount >= 0
  //   deposit_kept_amount >= 0
  //   deposit_kept_amount <= deposit_amount  (can't keep more than was held)
  await knex.raw(`
    ALTER TABLE rentals ADD CONSTRAINT rentals_deposit_amounts_sane CHECK (
      deposit_amount >= 0
      AND deposit_kept_amount >= 0
      AND deposit_kept_amount <= deposit_amount
    );
  `);

  // Status / amount consistency: only 'partial' and 'forfeited' can have a
  // non-zero kept amount. 'refunded' must have kept = 0.
  await knex.raw(`
    ALTER TABLE rentals ADD CONSTRAINT rentals_deposit_status_kept_consistent CHECK (
      (deposit_status IN ('none', 'held', 'refunded') AND deposit_kept_amount = 0)
      OR (deposit_status IN ('partial', 'forfeited') AND deposit_kept_amount > 0)
    );
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable("rentals", (t) => {
    t.dropColumn("deposit_notes");
    t.dropColumn("deposit_resolved_by");
    t.dropColumn("deposit_resolved_at");
    t.dropColumn("deposit_kept_amount");
    t.dropColumn("deposit_status");
    t.dropColumn("deposit_amount");
  });
  await knex.schema.alterTable("equipment", (t) => {
    t.dropColumn("deposit_amount");
  });
  await knex.raw(`DROP TYPE IF EXISTS deposit_status CASCADE;`);
};
