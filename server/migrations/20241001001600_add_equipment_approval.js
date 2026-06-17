// 017. Equipment approval workflow — owners' new listings require admin
// approval before becoming visible to buyers/renters.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE TYPE equipment_approval_status AS ENUM (
      'pending',
      'approved',
      'rejected'
    );
  `);

  await knex.schema.alterTable("equipment", (t) => {
    t.specificType("approval_status", "equipment_approval_status")
      .notNullable()
      .defaultTo("pending");
    t.text("rejection_reason");
    t.timestamp("approved_at", { useTz: true });
    t.uuid("approved_by").references("id").inTable("users").onDelete("SET NULL");
    t.index(["approval_status", "created_at"]);
  });

  // Auto-approve existing rows so we don't break dev setups.
  await knex("equipment")
    .whereNull("approved_at")
    .update({
      approval_status: "approved",
      approved_at: knex.fn.now(),
    });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable("equipment", (t) => {
    t.dropColumn("approval_status");
    t.dropColumn("rejection_reason");
    t.dropColumn("approved_at");
    t.dropColumn("approved_by");
  });
  await knex.raw(`DROP TYPE IF EXISTS equipment_approval_status CASCADE;`);
};
