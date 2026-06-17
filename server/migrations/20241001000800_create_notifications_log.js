// 009. Notifications log. One row per delivery attempt per channel.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable("notifications_log", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    t.specificType("type", "notification_type").notNullable();
    t.specificType("channel", "notification_channel").notNullable();

    t.string("title", 200).notNullable();
    t.text("message").notNullable();

    // Structured payload (e.g. { orderId, trackingNumber })
    t.jsonb("metadata").notNullable().defaultTo("{}");

    // Provider-reported delivery state
    t.boolean("sent").notNullable().defaultTo(false);
    t.timestamp("sent_at", { useTz: true });
    t.text("send_error");

    // Only meaningful for in_app notifications
    t.boolean("is_read").notNullable().defaultTo(false);
    t.timestamp("read_at", { useTz: true });

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index(["user_id", "is_read"]);
    t.index(["user_id", "channel"]);
    t.index(["type"]);
    t.index(["created_at"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("notifications_log");
};
