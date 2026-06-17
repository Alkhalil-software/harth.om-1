const knex = require("../db");

/**
 * Wishlist / favorites. add() is idempotent — adding twice returns the
 * existing row rather than erroring, which matches the "heart" button UX.
 */

async function add(userId, equipmentId) {
  try {
    const [row] = await knex("wishlist_items")
      .insert({ user_id: userId, equipment_id: equipmentId })
      .returning("*");
    return row;
  } catch (err) {
    if (err.code === "23505") {
      // Already wishlisted — return the existing row.
      return knex("wishlist_items")
        .where({ user_id: userId, equipment_id: equipmentId })
        .first();
    }
    throw err;
  }
}

async function remove(userId, equipmentId) {
  const count = await knex("wishlist_items")
    .where({ user_id: userId, equipment_id: equipmentId })
    .del();
  return count > 0;
}

async function isWishlisted(userId, equipmentId) {
  const row = await knex("wishlist_items")
    .where({ user_id: userId, equipment_id: equipmentId })
    .first("id");
  return !!row;
}

/**
 * Paginated list with equipment joined for display.
 */
async function list(userId, { page = 1, limit = 20, search = null, category = null, listing_type = null } = {}) {
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const offset = (safePage - 1) * safeLimit;

  // Build the base data query. We apply both wishlist ownership AND any
  // filter from the user (search/category/listing_type) inside the join so
  // the count below can mirror the same predicates.
  const dataQ = knex("wishlist_items as w")
    .join("equipment as e", "e.id", "w.equipment_id")
    .where("w.user_id", userId)
    .select(
      "w.id as wishlist_id",
      "w.created_at as favorited_at",
      "e.id as equipment_id",
      "e.id",
      "e.name",
      "e.description",
      "e.category",
      "e.listing_type",
      "e.status",
      "e.daily_price",
      "e.sale_price",
      "e.stock",
      "e.images",
      "e.primary_image_url",
      "e.governorate",
      "e.avg_rating",
      "e.ratings_count",
      "e.owner_id",
    )
    .orderBy("w.created_at", "desc")
    .limit(safeLimit)
    .offset(offset);

  const countQ = knex("wishlist_items as w")
    .join("equipment as e", "e.id", "w.equipment_id")
    .where("w.user_id", userId)
    .count("* as c")
    .first();

  // Apply user-supplied filters to BOTH queries identically.
  for (const q of [dataQ, countQ]) {
    if (category) q.where("e.category", category);
    if (listing_type) {
      // 'sale' should also include 'both'; same for 'rent'.
      if (listing_type === "sale") {
        q.whereIn("e.listing_type", ["sale", "both"]);
      } else if (listing_type === "rent") {
        q.whereIn("e.listing_type", ["rent", "both"]);
      } else {
        q.where("e.listing_type", listing_type);
      }
    }
    if (search) {
      // Case-insensitive partial match against name OR description.
      const needle = `%${search}%`;
      q.where((w) => {
        w.where("e.name", "ilike", needle).orWhere("e.description", "ilike", needle);
      });
    }
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
 * Bulk check: given a list of equipment ids, return the subset the user
 * has wishlisted. Used by the equipment list endpoint to hydrate the
 * heart icon state without N+1 queries.
 */
async function wishlistedSubset(userId, equipmentIds) {
  if (!userId || !equipmentIds?.length) return new Set();
  const rows = await knex("wishlist_items")
    .where("user_id", userId)
    .whereIn("equipment_id", equipmentIds)
    .select("equipment_id");
  return new Set(rows.map((r) => r.equipment_id));
}

module.exports = {
  add,
  remove,
  isWishlisted,
  list,
  wishlistedSubset,
};
