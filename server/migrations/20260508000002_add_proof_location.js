// Add GPS location + client timestamp to delivery proof stages.
// Stored as JSONB: { lat, lng, accuracy, client_ts (ISO string) }

exports.up = async function (knex) {
  await knex.schema.alterTable("delivery_requests", (t) => {
    t.jsonb("pickup_proof_location");   // { lat, lng, accuracy, client_ts }
    t.jsonb("delivery_proof_location"); // { lat, lng, accuracy, client_ts }
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("delivery_requests", (t) => {
    t.dropColumn("pickup_proof_location");
    t.dropColumn("delivery_proof_location");
  });
};
