// 021. KYC (Know-Your-Customer) document upload + verification workflow.
//
// Up to now `users.identity` was a free-text national-ID number. That's
// brittle — an admin had no way to actually verify the number belonged
// to the person who typed it. This migration layers a real document
// review on top:
//
//   - `id_front_url`, `id_back_url`     : photo of the ID card (both faces)
//   - `selfie_url`                       : selfie holding the ID, anti-fraud
//   - `identity_status`                  : none | pending | approved | rejected
//   - `identity_verified`                : convenience boolean = (status='approved').
//                                          Kept as its own column so it can be
//                                          indexed and joined cheaply, and so the
//                                          'موثَّق' badge can be looked up
//                                          without a CASE expression on every read.
//   - `identity_submitted_at`            : when the user uploaded the docs
//   - `identity_reviewed_at`,
//     `identity_reviewed_by`,
//     `identity_rejection_reason`        : audit trail for the admin decision
//
// The `identity` text column is preserved — it now stores the ID NUMBER
// the user typed during KYC submission (for cross-checking against the
// uploaded photo), which is a clearer separation than before.
//
// Renters (consumers) don't strictly need KYC — anyone can buy. Owners
// and delivery agents are the ones we gate on it, since they handle
// money / merchandise / customer addresses. We don't enforce that
// here at the schema level; routes do.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE TYPE identity_status AS ENUM (
      'none',
      'pending',
      'approved',
      'rejected'
    );
  `);

  await knex.schema.alterTable("users", (t) => {
    t.string("id_front_url", 500);
    t.string("id_back_url", 500);
    t.string("selfie_url", 500);

    t.specificType("identity_status", "identity_status")
      .notNullable()
      .defaultTo("none");
    t.boolean("identity_verified").notNullable().defaultTo(false);

    t.timestamp("identity_submitted_at", { useTz: true });
    t.timestamp("identity_reviewed_at", { useTz: true });
    t.uuid("identity_reviewed_by")
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    t.text("identity_rejection_reason");

    t.index("identity_status");
    t.index("identity_verified");
  });

  // Keep identity_verified consistent with identity_status. We could do
  // this with a generated column, but Knex/pg generated columns are awkward
  // across versions; an app-layer write keeps it simple.
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable("users", (t) => {
    t.dropColumn("identity_rejection_reason");
    t.dropColumn("identity_reviewed_by");
    t.dropColumn("identity_reviewed_at");
    t.dropColumn("identity_submitted_at");
    t.dropColumn("identity_verified");
    t.dropColumn("identity_status");
    t.dropColumn("selfie_url");
    t.dropColumn("id_back_url");
    t.dropColumn("id_front_url");
  });
  await knex.raw(`DROP TYPE IF EXISTS identity_status CASCADE;`);
};
