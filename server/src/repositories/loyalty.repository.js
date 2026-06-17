const knex = require("../db");
const { AppError } = require("../middleware/errorHandler");

/**
 * Loyalty points ledger.
 *
 * The users.loyalty_points column is a CACHED sum of non-expired, unspent
 * credit rows. It is updated synchronously inside every loyalty write here.
 * That way the existing order-calculator keeps working as-is.
 *
 * Credits (earn/referral_bonus/admin_adjust+) set `remaining` equal to
 * their amount. Spend and expiry decrement `remaining` of earlier credits
 * in FIFO order (oldest first).
 */

const POINTS_LIFETIME_DAYS = 365;
const REFERRER_BONUS = 200;
const REFERRED_BONUS = 100;

/**
 * Recompute users.loyalty_points by summing non-expired remaining credits.
 * Called after any ledger write inside the same transaction.
 */
async function syncUserBalance(trx, userId) {
  const row = await trx("loyalty_transactions")
    .where({ user_id: userId })
    .andWhereRaw("remaining > 0")
    .andWhere((qb) => {
      qb.whereNull("expires_at").orWhere("expires_at", ">", trx.fn.now());
    })
    .sum({ total: "remaining" })
    .first();
  const balance = parseInt(row?.total ?? 0, 10) || 0;
  await trx("users").where({ id: userId }).update({ loyalty_points: balance });
  return balance;
}

/**
 * Credit points (earn / referral_bonus / admin_adjust). Amount > 0.
 */
async function credit({
  userId,
  kind,
  amount,
  orderId = null,
  rentalId = null,
  referredUserId = null,
  notes = null,
  lifetimeDays = POINTS_LIFETIME_DAYS,
  trx = null,
}) {
  if (amount <= 0) throw new AppError("Credit amount must be positive", 400);

  const run = async (t) => {
    const expiresAt = lifetimeDays
      ? new Date(Date.now() + lifetimeDays * 24 * 60 * 60 * 1000)
      : null;

    const [row] = await t("loyalty_transactions")
      .insert({
        user_id: userId,
        kind,
        amount,
        remaining: amount,
        expires_at: expiresAt,
        order_id: orderId,
        rental_id: rentalId,
        referred_user_id: referredUserId,
        notes,
      })
      .returning("*");

    await syncUserBalance(t, userId);
    return row;
  };

  return trx ? run(trx) : knex.transaction(run);
}

/**
 * Debit points (spend / expire). Accepts a POSITIVE amount and writes a
 * negative row. Consumes credits FIFO (oldest non-expired earn first).
 *
 * Throws AppError if insufficient balance.
 */
async function debit({
  userId,
  kind,
  amount,
  orderId = null,
  rentalId = null,
  notes = null,
  trx = null,
}) {
  if (amount <= 0) throw new AppError("Debit amount must be positive", 400);

  const run = async (t) => {
    // Lock the credit rows we're going to consume so a parallel spend
    // can't oversell.
    const credits = await t("loyalty_transactions")
      .where({ user_id: userId })
      .andWhereIn("kind", ["earn", "referral_bonus", "admin_adjust"])
      .andWhereRaw("remaining > 0")
      .andWhere((qb) => {
        qb.whereNull("expires_at").orWhere("expires_at", ">", t.fn.now());
      })
      .orderBy("created_at", "asc") // FIFO
      .forUpdate()
      .select("id", "remaining");

    const total = credits.reduce((s, c) => s + Number(c.remaining), 0);
    if (total < amount) {
      throw new AppError(
        `Insufficient loyalty points: need ${amount}, have ${total}`,
        400,
      );
    }

    let toDeduct = amount;
    for (const c of credits) {
      if (toDeduct <= 0) break;
      const take = Math.min(Number(c.remaining), toDeduct);
      await t("loyalty_transactions")
        .where({ id: c.id })
        .update({ remaining: Number(c.remaining) - take });
      toDeduct -= take;
    }

    const [row] = await t("loyalty_transactions")
      .insert({
        user_id: userId,
        kind,
        amount: -amount,
        remaining: 0,
        order_id: orderId,
        rental_id: rentalId,
        notes,
      })
      .returning("*");

    await syncUserBalance(t, userId);
    return row;
  };

  return trx ? run(trx) : knex.transaction(run);
}

/**
 * Background sweep: expire credits whose expires_at has passed. Creates
 * one 'expire' row per user who had expiring points, so the ledger is
 * always an accurate story.
 *
 * Idempotent — running it twice a day is fine; it only catches new
 * expirations.
 */
async function expireStalePoints() {
  return knex.transaction(async (t) => {
    // Find users with expired credits still having remaining>0.
    const rows = await t("loyalty_transactions")
      .whereRaw("expires_at IS NOT NULL AND expires_at <= NOW()")
      .andWhereRaw("remaining > 0")
      .andWhereIn("kind", ["earn", "referral_bonus", "admin_adjust"])
      .forUpdate()
      .select("id", "user_id", "remaining");

    // Group by user so we write one expire row per user.
    const byUser = new Map();
    for (const r of rows) {
      const prev = byUser.get(r.user_id) || 0;
      byUser.set(r.user_id, prev + Number(r.remaining));
    }

    // Zero out remaining on the expired credits.
    for (const r of rows) {
      await t("loyalty_transactions")
        .where({ id: r.id })
        .update({ remaining: 0 });
    }

    // Record one 'expire' debit per user.
    const inserted = [];
    for (const [userId, total] of byUser) {
      if (total <= 0) continue;
      const [row] = await t("loyalty_transactions")
        .insert({
          user_id: userId,
          kind: "expire",
          amount: -total,
          remaining: 0,
          notes: "Automatic expiry sweep",
        })
        .returning("*");
      inserted.push(row);
      await syncUserBalance(t, userId);
    }

    return { expired_users: inserted.length, total_points: inserted.reduce((s, r) => s + Math.abs(r.amount), 0) };
  });
}

/**
 * Return the user's current balance (cached) plus the most recent ledger
 * rows for display in a "my points" page.
 */
async function getBalanceAndHistory(userId, { page = 1, limit = 20 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (safePage - 1) * safeLimit;

  const [user, items, countRow] = await Promise.all([
    knex("users").where({ id: userId }).first("loyalty_points"),
    knex("loyalty_transactions")
      .where({ user_id: userId })
      .select("*")
      .orderBy("created_at", "desc")
      .limit(safeLimit)
      .offset(offset),
    knex("loyalty_transactions")
      .where({ user_id: userId })
      .count("* as c")
      .first(),
  ]);

  const total = parseInt(countRow.c, 10);
  return {
    balance: parseInt(user?.loyalty_points ?? 0, 10),
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

module.exports = {
  credit,
  debit,
  syncUserBalance,
  expireStalePoints,
  getBalanceAndHistory,
  POINTS_LIFETIME_DAYS,
  REFERRER_BONUS,
  REFERRED_BONUS,
};
