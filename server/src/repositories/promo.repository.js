const knex = require("../db");

const PUBLIC_FIELDS = [
  "id",
  "code",
  "type",
  "value",
  "min_order_total",
  "max_discount",
  "max_uses",
  "used_count",
  "expiry_date",
  "is_active",
  "created_at",
  "updated_at",
];

/**
 * Fetch an active, valid promo by code. Returns null if the code doesn't
 * exist, is disabled, is expired, or has reached its max_uses.
 *
 * The availability check is in SQL so we don't race with other orders
 * consuming the last use.
 */
async function findValidByCode(code, trx = knex) {
  if (!code) return null;
  return trx("promo_codes")
    .where({ code })
    .andWhere({ is_active: true })
    .andWhere((qb) => {
      qb.whereNull("expiry_date").orWhere("expiry_date", ">=", trx.fn.now());
    })
    .andWhere((qb) => {
      qb.whereNull("max_uses").orWhereRaw("used_count < max_uses");
    })
    .first();
}

/**
 * Atomically increment used_count. Returns true if the increment succeeded
 * (the code was still available). Returns false if somebody else consumed
 * the last use in the interim.
 */
async function consumeUse(promoId, trx = knex) {
  const updated = await trx("promo_codes")
    .where({ id: promoId, is_active: true })
    .andWhere((qb) => {
      qb.whereNull("max_uses").orWhereRaw("used_count < max_uses");
    })
    .increment("used_count", 1);
  return updated > 0;
}

/**
 * Release a consumed use — used when a payment fails after the promo
 * was counted. Idempotent: allows used_count to drop to 0 but never negative
 * (also enforced by CHECK constraint).
 */
async function releaseUse(promoId, trx = knex) {
  const row = await trx("promo_codes")
    .where({ id: promoId })
    .first("used_count");
  if (!row || row.used_count <= 0) return false;
  const updated = await trx("promo_codes")
    .where({ id: promoId })
    .andWhere("used_count", ">", 0)
    .decrement("used_count", 1);
  return updated > 0;
}

// ─── Admin CRUD ──────────────────────────────────────────────────────────

async function listAll({ page = 1, limit = 20, activeOnly = false } = {}) {
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (safePage - 1) * safeLimit;

  const dataQ = knex("promo_codes")
    .select(PUBLIC_FIELDS)
    .orderBy("created_at", "desc")
    .limit(safeLimit)
    .offset(offset);
  const countQ = knex("promo_codes").count("* as c").first();
  if (activeOnly) {
    dataQ.andWhere("is_active", true);
    countQ.andWhere("is_active", true);
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

async function getById(id) {
  return knex("promo_codes").where({ id }).first(PUBLIC_FIELDS);
}

async function create(data) {
  const [row] = await knex("promo_codes").insert(data).returning(PUBLIC_FIELDS);
  return row;
}

async function update(id, patch) {
  const [row] = await knex("promo_codes")
    .where({ id })
    .update(patch)
    .returning(PUBLIC_FIELDS);
  return row || null;
}

async function remove(id) {
  const count = await knex("promo_codes").where({ id }).del();
  return count > 0;
}

module.exports = {
  findValidByCode,
  consumeUse,
  releaseUse,
  listAll,
  getById,
  create,
  update,
  remove,
  PUBLIC_FIELDS,
};
