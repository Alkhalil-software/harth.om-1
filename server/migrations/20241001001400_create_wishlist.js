// 015. Wishlist (favorites). Simple join table with no extra state.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable("wishlist_items", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    t.uuid("equipment_id")
      .notNullable()
      .references("id")
      .inTable("equipment")
      .onDelete("CASCADE");

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // One row per (user, equipment) — the natural uniqueness of a favorite.
    t.unique(["user_id", "equipment_id"]);
    t.index(["user_id", "created_at"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("wishlist_items");
};
