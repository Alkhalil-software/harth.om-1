// 023. Admin audit log.
//
// Every privileged action an admin performs writes a row here. The table
// is append-only by convention (no UPDATE / DELETE in app code; admins
// who need to backdate something add a new entry rather than rewrite
// history). This is the single source of truth when a customer asks
// "who suspended my account and when?".
//
// Schema notes:
//   - actor_id is the admin who did the thing. We keep their name/role
//     denormalized too because if the admin is later deleted we still
//     want a readable audit trail.
//   - action is a short machine code (snake_case) — not free text. The
//     app layer is responsible for the vocabulary; we keep it as a
//     varchar instead of an enum so adding a new action doesn't need a
//     migration. A CHECK constraint enforces non-empty.
//   - target_type + target_id together identify what the action touched
//     (user, equipment, order, rental, promo, commission, payout_batch,
//     etc). target_type is varchar for the same flexibility reason as
//     action; target_id is varchar to fit both UUIDs and the occasional
//     string id (e.g. "promo:WELCOME10" if we ever want it).
//   - before / after store the relevant slice of state as JSONB. Don't
//     dump the whole row — keep just the fields that changed plus a few
//     identifiers, otherwise the table balloons.
//   - request metadata (ip, user_agent) is captured at controller time
//     for forensics.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable("admin_audit_logs", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    // Who did it.
    t.uuid("actor_id")
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    // Snapshot of the actor for resilience against deletes.
    t.string("actor_name", 200);
    t.string("actor_email", 320);

    // What & where.
    t.string("action", 80).notNullable();
    t.string("target_type", 60);
    t.string("target_id", 100);

    // Optional structured before/after diff. Keep both nullable so simple
    // actions that don't touch a row (e.g. 'admin_login') can omit them.
    t.jsonb("before");
    t.jsonb("after");

    // Free-form notes (e.g. an admin's reason text on a rejection).
    t.text("notes");

    // Request context.
    t.string("ip", 64);
    t.string("user_agent", 500);

    t.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    t.index("actor_id");
    t.index("action");
    t.index(["target_type", "target_id"]);
    t.index("created_at");
  });

  await knex.raw(`
    ALTER TABLE admin_audit_logs
    ADD CONSTRAINT admin_audit_action_nonempty
    CHECK (length(action) > 0);
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("admin_audit_logs");
};
