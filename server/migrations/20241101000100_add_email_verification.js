// 020. Email verification + multi-purpose OTP table.
//
// Two changes here:
//
// 1. `users.email_verified` + `users.email_verified_at` — flips to true
//    once the user enters the OTP we emailed them. The verified email is one
//    of the trust signals shown on a farmer's card (and gates the
//    "موثَّق" badge alongside the other identity checks).
//
// 2. `auth_otps` — a generic OTP store used for:
//      - email verification at registration
//      - password reset (forgot password) for anonymous users
//      - password change for already-logged-in users
//      - any future sensitive action (re-auth)
//    The code itself is never stored in clear: we keep a bcrypt hash so a
//    DB leak doesn't expose live OTPs. Codes are valid for 10 minutes and
//    invalidated after a successful verification or after 5 wrong tries.
//
// We deliberately do NOT block login on unverified emails — pending
// account_status already gates the things owners/delivery agents can do.
// Email verification is a TRUST signal; users can still browse and buy
// while their email is unverified, they just won't get the verified badge.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  // 1. email_verified columns on users
  await knex.schema.alterTable("users", (t) => {
    t.boolean("email_verified").notNullable().defaultTo(false);
    t.timestamp("email_verified_at", { useTz: true });
    t.index("email_verified");
  });

  // 2. Existing users have presumably proven their email already (or we'd
  // have no way to contact them). Don't lock anyone out — backfill to true.
  await knex("users").update({
    email_verified: true,
    email_verified_at: knex.fn.now(),
  });

  // 3. OTP type enum
  await knex.raw(`
    CREATE TYPE otp_purpose AS ENUM (
      'email_verification',
      'password_reset',
      'password_change'
    );
  `);

  // 4. auth_otps table — a small ledger of issued one-time codes.
  await knex.schema.createTable("auth_otps", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    // Two ways to look up a code:
    //   - by user_id (for password_change while authenticated)
    //   - by email (for password_reset where the user is anonymous, or
    //     for email_verification right after register before login)
    // We index both so either path is O(log n).
    t.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");
    t.string("email", 255).notNullable();

    t.specificType("purpose", "otp_purpose").notNullable();

    // bcrypt hash of the 6-digit code. Never store the plain code.
    t.string("code_hash", 255).notNullable();

    t.timestamp("expires_at", { useTz: true }).notNullable();

    // How many times the user has tried to enter the wrong code on this row.
    // After OTP_MAX_ATTEMPTS (5) the row is treated as consumed.
    t.integer("attempts").notNullable().defaultTo(0);

    // Set when a correct code is entered. A consumed row can no longer be
    // used — the user must request a new code.
    t.timestamp("consumed_at", { useTz: true });

    // Where the request came from. Useful for forensics if a flood happens.
    t.string("requester_ip", 64);

    t.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    t.index(["email", "purpose"]);
    t.index(["user_id", "purpose"]);
    t.index("expires_at"); // for the cleanup job
  });

  // Cap attempts at a sane upper bound so a CHECK fires before integer wraps.
  await knex.raw(`
    ALTER TABLE auth_otps ADD CONSTRAINT auth_otps_attempts_sane
    CHECK (attempts >= 0 AND attempts <= 100);
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("auth_otps");
  await knex.raw(`DROP TYPE IF EXISTS otp_purpose CASCADE;`);
  await knex.schema.alterTable("users", (t) => {
    t.dropColumn("email_verified_at");
    t.dropColumn("email_verified");
  });
};
