exports.up = async function (knex) {
  await knex.schema.alterTable("rentals", (t) => {
    t.string("tracking_number", 20).nullable().unique();
  });

  // Backfill existing rows with IJ- prefixed numbers
  const rows = await knex("rentals").select("id");
  const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const crypto = require("crypto");

  for (const row of rows) {
    let code = "";
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
    await knex("rentals").where({ id: row.id }).update({ tracking_number: `IJ-${code}` });
  }
};

exports.down = async function (knex) {
  await knex.schema.alterTable("rentals", (t) => {
    t.dropColumn("tracking_number");
  });
};
