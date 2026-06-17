// 028. Backfill email_verified=true for everyone.
//
// Email verification was removed as a feature. New accounts now register
// already verified, but pre-existing accounts that registered under the
// old flow may still have email_verified=false (e.g. they skipped the
// OTP step at the time). This one-shot backfill flips them all to true
// so the verified-badge logic and any account-listing UI behave
// consistently.
//
// Down: we do nothing on rollback. We can't accurately reconstruct
// "who hadn't verified at the moment we ran the up migration" — and
// even if we could, there's no UX that benefits from doing so.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex("users")
    .where({ email_verified: false })
    .update({
      email_verified: true,
      email_verified_at: knex.fn.now(),
    });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function () {
  // intentionally a no-op
};
