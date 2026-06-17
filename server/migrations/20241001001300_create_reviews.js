// 014. Equipment reviews. A review is always tied to a completed
// transaction (order_item or rental) so ratings are authentic.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.raw(`CREATE TYPE review_source AS ENUM ('order', 'rental');`);

  await knex.schema.createTable("reviews", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    t.uuid("equipment_id")
      .notNullable()
      .references("id")
      .inTable("equipment")
      .onDelete("CASCADE");

    t.uuid("reviewer_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    t.specificType("source", "review_source").notNullable();
    t.uuid("order_id").references("id").inTable("orders").onDelete("SET NULL");
    t.uuid("rental_id")
      .references("id")
      .inTable("rentals")
      .onDelete("SET NULL");

    // Ratings are whole 1-5 stars. CHECK enforces range.
    t.integer("rating").notNullable();
    t.text("comment");

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // One review per (reviewer, source, source_id) — prevents a user from
    // reviewing the same equipment twice for the same transaction.
    t.unique(["reviewer_id", "source", "order_id"]);
    t.unique(["reviewer_id", "source", "rental_id"]);

    t.index(["equipment_id", "created_at"]);
    t.index("reviewer_id");
  });

  await knex.raw(`
    ALTER TABLE reviews ADD CONSTRAINT reviews_rating_range
    CHECK (rating BETWEEN 1 AND 5);
  `);
  // Exactly one of order_id / rental_id must match source.
  await knex.raw(`
    ALTER TABLE reviews ADD CONSTRAINT reviews_source_link
    CHECK (
      (source = 'order' AND order_id IS NOT NULL AND rental_id IS NULL)
      OR (source = 'rental' AND rental_id IS NOT NULL AND order_id IS NULL)
    );
  `);

  // Hook into the shared updated_at trigger.
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_reviews_updated_at ON reviews;
    CREATE TRIGGER set_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("reviews");
  await knex.raw(`DROP TYPE IF EXISTS review_source CASCADE;`);
};
