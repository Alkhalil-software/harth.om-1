// 010. updated_at triggers for every table that has an updated_at column.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  // Single shared trigger function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  const tables = [
    "users",
    "equipment",
    "rentals",
    "orders",
    "promo_codes",
    "delivery_requests",
  ];
  for (const table of tables) {
    await knex.raw(`
      DROP TRIGGER IF EXISTS set_${table}_updated_at ON ${table};
      CREATE TRIGGER set_${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    `);
  }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  const tables = [
    "users",
    "equipment",
    "rentals",
    "orders",
    "promo_codes",
    "delivery_requests",
  ];
  for (const table of tables) {
    await knex.raw(`DROP TRIGGER IF EXISTS set_${table}_updated_at ON ${table};`);
  }
  await knex.raw(`DROP FUNCTION IF EXISTS trigger_set_updated_at() CASCADE;`);
};
