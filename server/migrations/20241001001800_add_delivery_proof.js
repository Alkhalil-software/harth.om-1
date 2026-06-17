// 019. Courier proof-of-work images.
//
// When a courier confirms pickup and confirms delivery, they upload a photo
// as evidence. Stored as JSONB arrays so multiple photos per stage are
// possible (e.g. photo of the package + photo of the recipient signing).

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("delivery_requests", (t) => {
    // Photos uploaded at pickup time (when courier confirms they collected
    // the package from the owner).
    t.jsonb("pickup_proof_images").notNullable().defaultTo("[]");
    // Photos uploaded at delivery time (when courier confirms handover to
    // the customer).
    t.jsonb("delivery_proof_images").notNullable().defaultTo("[]");
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable("delivery_requests", (t) => {
    t.dropColumn("pickup_proof_images");
    t.dropColumn("delivery_proof_images");
  });
};
