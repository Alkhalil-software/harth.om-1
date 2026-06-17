const knex = require("../db");
const { AppError } = require("../middleware/errorHandler");

/**
 * Commission ledger.
 *
 * Rate lookup by owner tier:
 *   non-PRO owner: 10%
 *   PRO owner:      5%
 *
 * Recorded once per order_item (on order paid) or rental (on completion).
 * Operations are idempotent — the unique partial indexes on order_item_id
 * and rental_id catch double-writes and we swallow the 23505.
 */

const STANDARD_RATE = 0.10;
const PRO_RATE = 0.05;

const PUBLIC_FIELDS = [
  "id",
  "owner_id",
  "order_id",
  "rental_id",
  "order_item_id",
  "rate",
  "gross_amount",
  "commission_amount",
  "net_amount",
  "was_pro_at_time",
  "status",
  "paid_at",
  "notes",
  "created_at",
  "updated_at",
];

/**
 * Round money to 2 decimal places.
 */
function money(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Pick the applicable rate for an owner. Called at computation time so
 * rate changes take effect on FUTURE commissions only — existing rows
 * keep the snapshot in their `rate` column.
 */
function rateFor(user) {
  if (user?.is_pro) {
    // PRO is only valid if the expiry hasn't passed. Defensive: treat
    // null expiry as "indefinite PRO" (admin-granted).
    const exp = user.pro_expires_at ? new Date(user.pro_expires_at) : null;
    if (!exp || exp > new Date()) return PRO_RATE;
  }
  return STANDARD_RATE;
}

/**
 * Create a commission record. Idempotent — returns null if one already
 * exists for this source (caller treats it as no-op).
 */
async function recordCommission({
  ownerId,
  grossAmount,
  orderId = null,
  rentalId = null,
  orderItemId = null,
  trx = null,
}) {
  if (!orderItemId && !rentalId) {
    throw new AppError("Must link to order_item_id or rental_id", 400);
  }

  const run = async (t) => {
    const owner = await t("users")
      .where({ id: ownerId })
      .first("id", "is_pro", "pro_expires_at");
    if (!owner) throw new AppError("Owner not found", 404);

    const rate = rateFor(owner);
    const gross = money(grossAmount);
    const commission = money(gross * rate);
    const net = money(gross - commission);

    try {
      const [row] = await t("commission_transactions")
        .insert({
          owner_id: ownerId,
          order_id: orderId,
          rental_id: rentalId,
          order_item_id: orderItemId,
          rate,
          gross_amount: gross,
          commission_amount: commission,
          net_amount: net,
          was_pro_at_time: rate === PRO_RATE,
          status: "pending",
        })
        .returning(PUBLIC_FIELDS);
      return row;
    } catch (err) {
      if (err.code === "23505") {
        // Already recorded for this source — idempotent no-op.
        return null;
      }
      throw err;
    }
  };

  return trx ? run(trx) : knex.transaction(run);
}

/**
 * For an order that just transitioned to paid, record one commission
 * row per line item. Each line groups by its equipment's owner (we
 * don't collapse because different owners might share an order — not
 * supported today, but the schema allows it).
 */
async function recordForOrder(orderId, trx) {
  const items = await trx("order_items as oi")
    .join("equipment as e", "e.id", "oi.equipment_id")
    .where("oi.order_id", orderId)
    .select(
      "oi.id as order_item_id",
      "oi.line_total",
      "e.owner_id",
    );

  const recorded = [];
  for (const it of items) {
    const row = await recordCommission({
      ownerId: it.owner_id,
      grossAmount: Number(it.line_total),
      orderId,
      orderItemId: it.order_item_id,
      trx,
    });
    if (row) recorded.push(row);
  }
  return recorded;
}

/**
 * For a rental that just completed. One commission on the total.
 */
async function recordForRental(rentalId, trx) {
  const rental = await trx("rentals")
    .where({ id: rentalId })
    .first("owner_id", "total_price");
  if (!rental) return null;
  return recordCommission({
    ownerId: rental.owner_id,
    grossAmount: Number(rental.total_price),
    rentalId,
    trx,
  });
}

/**
 * List commissions earned by an owner.
 */
async function listForOwner(ownerId, { page = 1, limit = 20, status = null } = {}) {
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (safePage - 1) * safeLimit;

  const dataQ = knex("commission_transactions")
    .where({ owner_id: ownerId })
    .select(PUBLIC_FIELDS)
    .orderBy("created_at", "desc")
    .limit(safeLimit)
    .offset(offset);

  const countQ = knex("commission_transactions")
    .where({ owner_id: ownerId })
    .count("* as c")
    .first();

  if (status) {
    dataQ.andWhere("status", status);
    countQ.andWhere("status", status);
  }

  const [items, countRow] = await Promise.all([dataQ, countQ]);
  const total = parseInt(countRow.c, 10);

  // Quick earning summary
  const summary = await knex("commission_transactions")
    .where({ owner_id: ownerId })
    .select(
      knex.raw("coalesce(sum(gross_amount), 0) as gross"),
      knex.raw("coalesce(sum(commission_amount), 0) as commission"),
      knex.raw("coalesce(sum(net_amount), 0) as net"),
      knex.raw(
        "coalesce(sum(net_amount) filter (where status = 'pending'), 0) as net_pending",
      ),
      knex.raw(
        "coalesce(sum(net_amount) filter (where status = 'paid'), 0) as net_paid",
      ),
    )
    .first();

  return {
    items,
    summary: {
      gross: Number(summary.gross) || 0,
      commission: Number(summary.commission) || 0,
      net: Number(summary.net) || 0,
      net_pending: Number(summary.net_pending) || 0,
      net_paid: Number(summary.net_paid) || 0,
    },
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

/**
 * Admin list — all commissions, paginated.
 */
async function listAll({ page = 1, limit = 20, status = null, ownerId = null } = {}) {
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (safePage - 1) * safeLimit;

  const dataQ = knex("commission_transactions as c")
    .leftJoin("users as u", "u.id", "c.owner_id")
    .select("c.*", "u.name as owner_name", "u.email as owner_email")
    .orderBy("c.created_at", "desc")
    .limit(safeLimit)
    .offset(offset);

  const countQ = knex("commission_transactions").count("* as c").first();

  for (const q of [dataQ, countQ]) {
    if (status) q.where(q === dataQ ? "c.status" : "status", status);
    if (ownerId) q.where(q === dataQ ? "c.owner_id" : "owner_id", ownerId);
  }

  const [items, countRow] = await Promise.all([dataQ, countQ]);
  const total = parseInt(countRow.c, 10);

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

/**
 * Admin: mark a commission as paid out to the owner.
 */
async function markPaid(commissionId) {
  const [row] = await knex("commission_transactions")
    .where({ id: commissionId, status: "pending" })
    .update({ status: "paid", paid_at: knex.fn.now() })
    .returning(PUBLIC_FIELDS);
  if (!row) throw new AppError("Commission not found or already paid", 404);
  return row;
}

async function markCancelled(commissionId, notes = null) {
  const patch = { status: "cancelled" };
  if (notes) patch.notes = notes;
  const [row] = await knex("commission_transactions")
    .where({ id: commissionId })
    .andWhereNot("status", "paid")
    .update(patch)
    .returning(PUBLIC_FIELDS);
  if (!row) throw new AppError("Commission not found or already paid", 404);
  return row;
}

module.exports = {
  STANDARD_RATE,
  PRO_RATE,
  rateFor,
  recordCommission,
  recordForOrder,
  recordForRental,
  listForOwner,
  listAll,
  markPaid,
  markCancelled,
};
