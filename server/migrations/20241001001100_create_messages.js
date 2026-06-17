// 012. Direct messages between users. No conversation entity — pairs are derived.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable("messages", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    t.uuid("sender_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    t.uuid("recipient_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    t.text("body").notNullable();

    // Optional attachment URL (single, kept simple — can expand later)
    t.string("attachment_url", 500);

    // Canonical pair key: lexicographically smaller uuid comes first. Lets us
    // index "conversation between A and B" without a separate conversations table.
    t.uuid("pair_a").notNullable();
    t.uuid("pair_b").notNullable();

    t.boolean("is_read").notNullable().defaultTo(false);
    t.timestamp("read_at", { useTz: true });

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index(["pair_a", "pair_b", "created_at"]);
    t.index(["recipient_id", "is_read"]);
    t.index(["sender_id"]);
  });

  // Enforce pair_a < pair_b so queries can rely on the ordering.
  await knex.raw(`
    ALTER TABLE messages ADD CONSTRAINT messages_pair_ordered
    CHECK (pair_a < pair_b);
  `);
  // Enforce pair matches sender/recipient (one is pair_a, the other pair_b).
  await knex.raw(`
    ALTER TABLE messages ADD CONSTRAINT messages_pair_matches
    CHECK (
      (sender_id = pair_a AND recipient_id = pair_b)
      OR (sender_id = pair_b AND recipient_id = pair_a)
    );
  `);
  // Can't message yourself.
  await knex.raw(`
    ALTER TABLE messages ADD CONSTRAINT messages_not_self
    CHECK (sender_id <> recipient_id);
  `);
  // Body must be non-empty (trimmed check in app layer too).
  await knex.raw(`
    ALTER TABLE messages ADD CONSTRAINT messages_body_nonempty
    CHECK (length(trim(body)) > 0);
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("messages");
};
