// 005. Rentals table. Uses the rental_status ENUM (distinct from order_status).

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable("rentals", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    t.uuid("equipment_id")
      .notNullable()
      .references("id")
      .inTable("equipment")
      .onDelete("RESTRICT"); // never cascade-delete a rental

    t.uuid("renter_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("RESTRICT");

    t.uuid("owner_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("RESTRICT"); // denormalized for fast "owner's rentals" queries

    t.date("start_date").notNullable();
    t.date("end_date").notNullable();

    // Snapshot pricing so later price edits to equipment don't mutate past rentals
    t.decimal("daily_price_snapshot", 12, 2).notNullable();
    t.decimal("total_price", 12, 2).notNullable();

    t.specificType("status", "rental_status").notNullable().defaultTo("pending");
    t.specificType("payment_status", "payment_status")
      .notNullable()
      .defaultTo("pending");

    t.text("renter_notes");
    t.text("owner_response"); // reason for rejection, etc.

    t.timestamp("approved_at", { useTz: true });
    t.timestamp("started_at", { useTz: true });
    t.timestamp("completed_at", { useTz: true });
    t.timestamp("cancelled_at", { useTz: true });

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index(["equipment_id", "status"]);
    t.index(["renter_id", "status"]);
    t.index(["owner_id", "status"]);
    t.index(["start_date", "end_date"]);
  });

  // end_date must be >= start_date (same-day 1-day rental allowed)
  await knex.raw(`
    ALTER TABLE rentals ADD CONSTRAINT rentals_dates_valid CHECK (end_date >= start_date);
  `);
  await knex.raw(`
    ALTER TABLE rentals ADD CONSTRAINT rentals_total_nonneg CHECK (total_price >= 0);
  `);
  await knex.raw(`
    ALTER TABLE rentals ADD CONSTRAINT rentals_price_snapshot_nonneg CHECK (daily_price_snapshot >= 0);
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("rentals");
};
