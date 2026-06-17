// Support ticketing system: support_tickets + support_messages

exports.up = async function (knex) {
  await knex.schema.createTable("support_tickets", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.string("ticket_number", 32).notNullable().unique();

    // Owner (nullable = guest ticket)
    t.uuid("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.string("guest_name", 200);
    t.string("guest_email", 255);

    // Classification
    t.string("category", 32).notNullable(); // technical, financial, account, orders, suggestion, complaint
    t.string("priority", 16).notNullable().defaultTo("medium"); // low, medium, high, urgent
    t.string("status", 32).notNullable().defaultTo("open");     // open, in_progress, resolved, closed
    t.string("subject", 255).notNullable();

    // Assignment
    t.uuid("assigned_to").references("id").inTable("users").onDelete("SET NULL");

    // SLA
    t.integer("sla_hours").notNullable().defaultTo(24);
    t.timestamp("sla_due_at", { useTz: true });

    // CSAT (customer satisfaction)
    t.integer("csat_score");  // 1–5
    t.text("csat_comment");

    t.timestamp("resolved_at", { useTz: true });
    t.timestamp("closed_at", { useTz: true });
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index("user_id");
    t.index("status");
    t.index("priority");
    t.index("assigned_to");
  });

  await knex.schema.createTable("support_messages", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("ticket_id").notNullable().references("id").inTable("support_tickets").onDelete("CASCADE");
    t.uuid("sender_id").references("id").inTable("users").onDelete("SET NULL");
    t.string("sender_type", 16).notNullable(); // user, agent, system, bot
    t.text("body").notNullable();
    t.jsonb("attachments").notNullable().defaultTo("[]");
    t.boolean("is_internal").notNullable().defaultTo(false);
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index("ticket_id");
  });

  // CSAT score constraint
  await knex.raw(`
    ALTER TABLE support_tickets
      ADD CONSTRAINT support_tickets_csat_range CHECK (csat_score IS NULL OR (csat_score BETWEEN 1 AND 5));
  `);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("support_messages");
  await knex.schema.dropTableIfExists("support_tickets");
};
