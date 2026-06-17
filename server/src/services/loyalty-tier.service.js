/**
 * Loyalty tiers — Bronze / Silver / Gold.
 *
 * The existing loyalty_transactions ledger already records every
 * earn/spend/expire row. A "tier" is just a derived view: it answers
 * the question "how loyal has this user been?" by looking at the
 * LIFETIME amount they've earned (not their current balance).
 *
 * Why lifetime-earned and not current balance?
 *   A user who earned 5,000 points and spent 4,800 is still a
 *   high-value customer; we don't want to demote them to Bronze the
 *   moment they redeem. Tiers are a recognition system, not a
 *   spending pool. Current balance lives on `users.loyalty_points`
 *   already and is used for redemption.
 *
 * Why a derived service instead of a `tier` column on users?
 *   The thresholds and perks are likely to change. Storing tier on
 *   the user means we'd have to backfill every time we tweak the
 *   curve, and an active user's tier could go stale between events.
 *   A small computed function keeps everything one query and one
 *   source of truth.
 *
 * Tier thresholds (lifetime earned):
 *   Bronze:    0–999      points
 *   Silver:    1,000–4,999
 *   Gold:      5,000+
 *
 * Each tier also has a list of perks. The frontend renders the perks
 * verbatim — keep them as user-facing strings, not codes.
 */

const knex = require("./../db");

// One source of truth for thresholds & perks. Exported so the admin
// dashboard can show the same numbers without round-tripping.
const TIERS = [
  {
    key: "bronze",
    name: "برونزي",
    icon: "fa-medal",
    color: "#cd7f32",
    min: 0,
    perks: [
      "كسب نقطة لكل ريال تنفقه",
      "إشعارات انخفاض الأسعار للمعدات المُفضَّلة",
      "الوصول لكل العروض العامة",
    ],
  },
  {
    key: "silver",
    name: "فضي",
    icon: "fa-award",
    color: "#c0c0c0",
    min: 1000,
    perks: [
      "كل امتيازات البرونزي",
      "خصم 5% على رسوم التوصيل",
      "أولوية في طلبات الإيجار",
      "تنبيهات مبكّرة بالعروض الموسمية",
    ],
  },
  {
    key: "gold",
    name: "ذهبي",
    icon: "fa-crown",
    color: "#f1c40f",
    min: 5000,
    perks: [
      "كل امتيازات الفضي",
      "خصم 10% على رسوم التوصيل",
      "دعم مخصّص أسرع",
      "الوصول لمعدات مميَّزة قبل الإعلان العام",
      "هدية موسمية مرّة واحدة في السنة",
    ],
  },
];

/**
 * Pick the highest tier the user qualifies for given their lifetime
 * earned-points total. Always returns at least the Bronze entry — a
 * brand-new user with 0 points is still on the loyalty ladder.
 */
function tierForPoints(lifetimeEarned) {
  let current = TIERS[0];
  for (const t of TIERS) {
    if (lifetimeEarned >= t.min) current = t;
  }
  return current;
}

/**
 * The "next tier" answer used to draw the progress bar. Returns null
 * if the user is already on the top tier (Gold) — UI shows a different
 * "max tier reached" state then.
 */
function nextTierForPoints(lifetimeEarned) {
  for (const t of TIERS) {
    if (lifetimeEarned < t.min) return t;
  }
  return null;
}

/**
 * Compose the full tier payload for a single user. Used by
 * /loyalty/me/tier.
 *
 * Returns:
 *   {
 *     balance,             // current redeemable balance
 *     lifetime_earned,     // sum of positive credit rows ever
 *     lifetime_spent,      // |sum| of debit rows ever
 *     current_tier,        // {...}
 *     next_tier,           // {...} or null if at the top
 *     progress_to_next,    // 0–1 fraction to render the progress bar
 *     points_to_next,      // integer or null
 *   }
 */
async function getTierForUser(userId) {
  // Pull current balance + lifetime aggregates in a single round trip.
  const [user, agg] = await Promise.all([
    knex("users").where({ id: userId }).first("loyalty_points"),
    knex("loyalty_transactions")
      .where({ user_id: userId })
      .select(
        knex.raw(
          // Lifetime earned: positive credit kinds. We exclude
          // `admin_adjust` from the "earned" notion when its amount is
          // negative (a corrective debit) — same row in the ledger has
          // amount<0 for those, so summing only positive amounts handles
          // it cleanly.
          "coalesce(sum(amount) filter (where amount > 0), 0)::int as lifetime_earned",
        ),
        knex.raw(
          "coalesce(abs(sum(amount) filter (where amount < 0)), 0)::int as lifetime_spent",
        ),
      )
      .first(),
  ]);

  const balance = parseInt(user?.loyalty_points ?? 0, 10) || 0;
  const lifetimeEarned = parseInt(agg?.lifetime_earned ?? 0, 10) || 0;
  const lifetimeSpent = parseInt(agg?.lifetime_spent ?? 0, 10) || 0;

  const current = tierForPoints(lifetimeEarned);
  const next = nextTierForPoints(lifetimeEarned);

  // Progress fraction toward the next tier. If at top, fraction=1
  // (full bar) — UI handles "maxed out" via next_tier===null.
  let progress = 1;
  let pointsToNext = null;
  if (next) {
    const span = next.min - current.min;
    const inTier = lifetimeEarned - current.min;
    progress = span > 0 ? Math.max(0, Math.min(1, inTier / span)) : 1;
    pointsToNext = Math.max(0, next.min - lifetimeEarned);
  }

  return {
    balance,
    lifetime_earned: lifetimeEarned,
    lifetime_spent: lifetimeSpent,
    current_tier: current,
    next_tier: next,
    progress_to_next: progress,
    points_to_next: pointsToNext,
  };
}

module.exports = {
  TIERS,
  tierForPoints,
  nextTierForPoints,
  getTierForUser,
};
