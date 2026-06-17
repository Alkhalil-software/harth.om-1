// 002. Create users table. Uses the user_role ENUM defined in 000001.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable("users", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.string("email", 255).notNullable().unique();
    t.string("phone", 32).unique();
    t.string("password_hash", 255).notNullable();

    // Cast to the ENUM type we already created
    t.specificType("role", "user_role").notNullable().defaultTo("renter");

    t.string("name", 200).notNullable();
    t.string("identity", 64); // national ID / CR number (optional)
    t.jsonb("location"); // { lat, lng, address, city }

    // Referral / loyalty prep (deeper logic in later phases)
    t.string("referral_code", 16).unique();
    t.uuid("referred_by").references("id").inTable("users").onDelete("SET NULL");
    t.integer("loyalty_points").notNullable().defaultTo(0);

    // PRO subscription (for owners) — used in commission calc later
    t.boolean("is_pro").notNullable().defaultTo(false);
    t.timestamp("pro_expires_at", { useTz: true });

    t.boolean("is_active").notNullable().defaultTo(true);
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index("role");
    t.index("is_active");
  });

  // Constraint: loyalty points never negative
  await knex.raw(
    `ALTER TABLE users ADD CONSTRAINT users_loyalty_nonneg CHECK (loyalty_points >= 0);`,
  );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("users");
};
