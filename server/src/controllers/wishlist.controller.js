const knex = require("../db");
const wishlistRepo = require("../repositories/wishlist.repository");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

/**
 * POST /wishlist
 */
const add = asyncHandler(async (req, res) => {
  const { equipment_id } = req.body;

  // Cheaper to verify the equipment exists up front than to bubble up a
  // FK violation. Also gives us a proper 404.
  const exists = await knex("equipment").where({ id: equipment_id }).first("id");
  if (!exists) throw new AppError("Equipment not found", 404);

  const item = await wishlistRepo.add(req.user.id, equipment_id);
  res.status(201).json({ success: true, item });
});

/**
 * DELETE /wishlist/:equipmentId
 */
const remove = asyncHandler(async (req, res) => {
  const removed = await wishlistRepo.remove(
    req.user.id,
    req.params.equipmentId,
  );
  if (!removed) throw new AppError("Item was not in your wishlist", 404);
  res.json({ success: true });
});

/**
 * GET /wishlist
 */
const list = asyncHandler(async (req, res) => {
  const { page, limit, search, category, listing_type } = req.query;
  const result = await wishlistRepo.list(req.user.id, {
    page,
    limit,
    search: search || null,
    category: category || null,
    listing_type: listing_type || null,
  });
  res.json({ success: true, ...result });
});

/**
 * GET /wishlist/check/:equipmentId — quick single-item check.
 */
const check = asyncHandler(async (req, res) => {
  const wishlisted = await wishlistRepo.isWishlisted(
    req.user.id,
    req.params.equipmentId,
  );
  res.json({ success: true, wishlisted });
});

module.exports = { add, remove, list, check };
