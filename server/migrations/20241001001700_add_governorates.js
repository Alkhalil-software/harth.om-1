// 018. Oman governorates enum + columns on users/equipment.
// Values are the 11 official muhafazat of the Sultanate of Oman.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE TYPE oman_governorate AS ENUM (
      'muscat',
      'dhofar',
      'musandam',
      'buraimi',
      'dakhiliyah',
      'north_batinah',
      'south_batinah',
      'south_sharqiyah',
      'north_sharqiyah',
      'dhahirah',
      'wusta'
    );
  `);

  // Add governorate column to users (profile field)
  await knex.schema.alterTable("users", (t) => {
    t.specificType("governorate", "oman_governorate");
    t.index("governorate");
  });

  // Add governorate column to equipment (for filtering + display)
  await knex.schema.alterTable("equipment", (t) => {
    t.specificType("governorate", "oman_governorate");
    t.index("governorate");
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable("equipment", (t) => {
    t.dropColumn("governorate");
  });
  await knex.schema.alterTable("users", (t) => {
    t.dropColumn("governorate");
  });
  await knex.raw(`DROP TYPE IF EXISTS oman_governorate CASCADE;`);
};
