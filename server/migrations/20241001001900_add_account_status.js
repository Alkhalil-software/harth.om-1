// 019. Account approval workflow.
//
// Adds a formal `account_status` state machine to users:
//   - pending  : awaiting admin review (default for new farmer/delivery accounts)
//   - approved : admin approved → role permissions are active
//   - rejected : admin rejected the application; user can still browse/buy
//   - blocked  : admin suspended the account; user cannot use the system
//   - deleted  : account removed (soft delete; cannot log in)
//
// Consumers (renter) are auto-approved on signup since they only need to buy.
// Existing rows are auto-approved so we don't break dev/staging setups.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE TYPE account_status AS ENUM (
      'pending',
      'approved',
      'rejected',
      'blocked',
      'deleted'
    );
  `);

  await knex.schema.alterTable("users", (t) => {
    t.specificType("account_status", "account_status")
      .notNullable()
      .defaultTo("approved");
    t.text("status_reason"); // optional reason for rejection/block
    t.timestamp("status_changed_at", { useTz: true });
    t.uuid("status_changed_by")
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    t.index(["account_status", "role"]);
  });

  // Backfill existing users so the system keeps working:
  // every existing account is treated as already-approved.
  await knex("users").update({
    account_status: "approved",
    status_changed_at: knex.fn.now(),
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable("users", (t) => {
    t.dropColumn("status_changed_by");
    t.dropColumn("status_changed_at");
    t.dropColumn("status_reason");
    t.dropColumn("account_status");
  });
  await knex.raw(`DROP TYPE IF EXISTS account_status CASCADE;`);
};
