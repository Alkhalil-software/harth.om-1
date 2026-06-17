// User profile extension tables: user_profiles, user_sessions, user_activity_log

exports.up = async function (knex) {
  // Extended profile info (1-to-1 with users)
  await knex.schema.createTable("user_profiles", (t) => {
    t.uuid("user_id").primary().references("id").inTable("users").onDelete("CASCADE");

    // Public profile
    t.string("username", 64).unique();
    t.text("bio");
    t.date("birth_date");
    t.string("gender", 16);   // male, female, other
    t.string("country", 100);
    t.string("city", 100);
    t.string("phone", 32);
    t.string("avatar_url", 512);

    // Preferences
    t.string("theme", 16).notNullable().defaultTo("dark");
    t.string("language", 8).notNullable().defaultTo("ar");
    t.boolean("notif_orders").notNullable().defaultTo(true);
    t.boolean("notif_messages").notNullable().defaultTo(true);
    t.boolean("notif_promos").notNullable().defaultTo(false);
    t.boolean("notif_security").notNullable().defaultTo(true);
    t.boolean("notif_email").notNullable().defaultTo(true);
    t.boolean("notif_whatsapp").notNullable().defaultTo(false);
    t.boolean("login_alerts").notNullable().defaultTo(true);

    // Security
    t.boolean("two_fa_enabled").notNullable().defaultTo(false);
    t.string("two_fa_secret", 128);
    t.jsonb("backup_codes").defaultTo("[]");

    // GDPR
    t.timestamp("data_export_at", { useTz: true });

    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Active sessions (for "Devices" panel)
  await knex.schema.createTable("user_sessions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("token_hash", 128).notNullable().unique();
    t.string("ip_address", 64);
    t.text("device_info");
    t.timestamp("last_active", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index("user_id");
  });

  // Security & activity log
  await knex.schema.createTable("user_activity_log", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("action", 64).notNullable();
    t.text("description");
    t.string("ip_address", 64);
    t.text("device_info");
    t.string("risk_level", 16).notNullable().defaultTo("low"); // low, medium, high
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index("user_id");
    t.index("created_at");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("user_activity_log");
  await knex.schema.dropTableIfExists("user_sessions");
  await knex.schema.dropTableIfExists("user_profiles");
};
