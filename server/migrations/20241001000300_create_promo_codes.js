// 004. Promo codes. Created before orders so orders can FK to it.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable("promo_codes", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.string("code", 32).notNullable().unique();
    t.specificType("type", "promo_type").notNullable();

    // For percentage: 0..100 (as percent). For fixed: currency amount.
    t.decimal("value", 10, 2).notNullable();

    // Optional caps
    t.decimal("min_order_total", 10, 2); // minimum subtotal to apply
    t.decimal("max_discount", 10, 2); // cap on discount amount

    t.integer("max_uses"); // null = unlimited
    t.integer("used_count").notNullable().defaultTo(0);

    t.date("expiry_date");
    t.boolean("is_active").notNullable().defaultTo(true);

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index("code");
    t.index("is_active");
  });

  await knex.raw(`
    ALTER TABLE promo_codes ADD CONSTRAINT promo_value_nonneg CHECK (value >= 0);
  `);
  await knex.raw(`
    ALTER TABLE promo_codes ADD CONSTRAINT promo_used_nonneg CHECK (used_count >= 0);
  `);
  // If max_uses is set, used_count must not exceed it. NULL-friendly.
  await knex.raw(`
    ALTER TABLE promo_codes ADD CONSTRAINT promo_used_le_max CHECK (
      max_uses IS NULL OR used_count <= max_uses
    );
  `);
  // Percentage must be 0..100
  await knex.raw(`
    ALTER TABLE promo_codes ADD CONSTRAINT promo_pct_range CHECK (
      type <> 'percentage' OR (value >= 0 AND value <= 100)
    );
  `);

  // Seed a default code for testing. Use ASCII code to avoid locale issues.
  await knex("promo_codes").insert({
    code: "HARTH10",
    type: "percentage",
    value: 10.0,
    max_uses: null,
    is_active: true,
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("promo_codes");
};
