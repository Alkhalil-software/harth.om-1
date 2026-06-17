// 003. Equipment table. Supports both sale and rental (listing_type).

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable("equipment", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.string("name", 200).notNullable();
    t.text("description");

    t.specificType("category", "equipment_category").notNullable();
    t.specificType("status", "equipment_status")
      .notNullable()
      .defaultTo("available");
    t.specificType("listing_type", "listing_type")
      .notNullable()
      .defaultTo("rent");

    // Pricing — nullable because an equipment might be rent-only or sale-only.
    t.decimal("daily_price", 12, 2); // for rentals
    t.decimal("sale_price", 12, 2); // for sales

    // Inventory for sale items (rentals use availability via rentals table)
    t.integer("stock").notNullable().defaultTo(1);

    // Media
    t.jsonb("images").notNullable().defaultTo("[]"); // array of URLs
    t.string("primary_image_url", 500);

    // Extra structured data (power, weight, fuel, brand, ...)
    t.jsonb("specs").notNullable().defaultTo("{}");

    // Location (same shape as users.location)
    t.jsonb("location");

    // Ratings cache (updated by trigger / batch later)
    t.decimal("avg_rating", 3, 2).notNullable().defaultTo(0);
    t.integer("ratings_count").notNullable().defaultTo(0);

    t.uuid("owner_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // A given owner shouldn't duplicate the exact same listing name
    t.unique(["owner_id", "name"]);

    // Indexes for filters
    t.index("status");
    t.index("category");
    t.index("listing_type");
    t.index("owner_id");
    t.index("daily_price");
    t.index("sale_price");
    t.index("avg_rating");
  });

  // Business rule: non-negative prices / stock
  await knex.raw(
    `ALTER TABLE equipment ADD CONSTRAINT equipment_price_nonneg CHECK (
       (daily_price IS NULL OR daily_price >= 0)
       AND (sale_price IS NULL OR sale_price >= 0)
       AND stock >= 0
     );`,
  );

  // At least one price must be set consistent with listing_type
  await knex.raw(
    `ALTER TABLE equipment ADD CONSTRAINT equipment_price_for_listing CHECK (
       (listing_type = 'sale' AND sale_price IS NOT NULL)
       OR (listing_type = 'rent' AND daily_price IS NOT NULL)
       OR (listing_type = 'both' AND sale_price IS NOT NULL AND daily_price IS NOT NULL)
     );`,
  );

  // Full-text search on name+description (Arabic-friendly 'simple' config to avoid stemmer issues)
  await knex.raw(`
    CREATE INDEX equipment_search_idx ON equipment
    USING GIN (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')));
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("equipment");
};
