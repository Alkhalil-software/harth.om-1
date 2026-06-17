/**
 * Hero banners — admin-managed homepage promos.
 *
 * The public read filters live banners by:
 *   - is_active = true
 *   - active_from is null OR active_from <= now()
 *   - active_until is null OR active_until > now()
 * and orders by sort_order ASC then created_at DESC.
 *
 * Admin reads return everything regardless of state (so the admin can
 * see scheduled-future banners and re-enable archived ones).
 */

const knex = require("../db");

const PUBLIC_FIELDS = [
  "id",
  "title",
  "subtitle",
  "image_url",
  "cta_label",
  "cta_url",
  "placement",
  "active_from",
  "active_until",
  "is_active",
  "sort_order",
  "background_color",
  "text_color",
  "promo_code",
  "created_at",
  "updated_at",
];

/**
 * Live banners for the public site, optionally filtered by placement.
 * Cached by the route layer for ~60s.
 */
async function listLive({ placement = null } = {}) {
  const q = knex("hero_banners")
    .where({ is_active: true })
    .andWhere((w) => {
      w.whereNull("active_from").orWhere("active_from", "<=", knex.fn.now());
    })
    .andWhere((w) => {
      w.whereNull("active_until").orWhere("active_until", ">", knex.fn.now());
    })
    .orderBy("sort_order", "asc")
    .orderBy("created_at", "desc")
    .select(PUBLIC_FIELDS);

  if (placement) q.where({ placement });
  return q;
}

/**
 * Admin: list everything with pagination + optional filter.
 */
async function listAll({ page = 1, limit = 20, placement = null } = {}) {
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (safePage - 1) * safeLimit;

  const dataQ = knex("hero_banners")
    .select(PUBLIC_FIELDS)
    .orderBy("sort_order", "asc")
    .orderBy("created_at", "desc")
    .limit(safeLimit)
    .offset(offset);
  const countQ = knex("hero_banners").count("* as c").first();

  if (placement) {
    dataQ.where({ placement });
    countQ.where({ placement });
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
  return knex("hero_banners").where({ id }).first(PUBLIC_FIELDS);
}

const ALLOWED_FIELDS = [
  "title",
  "subtitle",
  "image_url",
  "cta_label",
  "cta_url",
  "placement",
  "active_from",
  "active_until",
  "is_active",
  "sort_order",
  "background_color",
  "text_color",
  "promo_code",
];

function pickAllowed(input) {
  const out = {};
  for (const k of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, k)) out[k] = input[k];
  }
  return out;
}

async function create(input, { createdBy = null } = {}) {
  const data = pickAllowed(input);
  if (!data.title) {
    const err = new Error("title is required");
    err.status = 400;
    throw err;
  }
  data.created_by = createdBy;
  const [row] = await knex("hero_banners").insert(data).returning(PUBLIC_FIELDS);
  return row;
}

async function update(id, input) {
  const data = pickAllowed(input);
  if (!Object.keys(data).length) return getById(id);
  const [row] = await knex("hero_banners")
    .where({ id })
    .update(data)
    .returning(PUBLIC_FIELDS);
  return row || null;
}

async function remove(id) {
  const count = await knex("hero_banners").where({ id }).del();
  return count > 0;
}

module.exports = {
  listLive,
  listAll,
  getById,
  create,
  update,
  remove,
};
