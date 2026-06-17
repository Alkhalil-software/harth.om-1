const knex = require("../db");
const cartRepo = require("../repositories/cart.repository");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { computeTotals } = require("../utils/order-calculator");

/**
 * Decorate a list of cart items with computed subtotals and surface
 * warnings (out of stock, listing no longer available, etc.) so the
 * client can show them without a second round trip.
 */
function decorateItems(items) {
  return items.map((it) => {
    const warnings = [];
    if (!["sale", "both"].includes(it.listing_type)) {
      warnings.push("This item is not available for purchase");
    }
    if (it.status !== "available") {
      warnings.push(`Status: ${it.status}`);
    }
    if (it.stock != null && it.quantity > it.stock) {
      warnings.push(`Only ${it.stock} in stock`);
    }
    const unit = it.sale_price != null ? Number(it.sale_price) : 0;
    const lineTotal =
      Math.round((unit * it.quantity + Number.EPSILON) * 100) / 100;
    return { ...it, unit_price: unit, line_total: lineTotal, warnings };
  });
}

/**
 * GET /cart
 */
const get = asyncHandler(async (req, res) => {
  const { cart, items } = await cartRepo.getCartWithItems(req.user.id);
  const decorated = decorateItems(items);

  const totals = computeTotals({
    items: decorated.map((i) => ({
      price_per_unit: i.unit_price,
      quantity: i.quantity,
    })),
  });

  res.json({
    success: true,
    cart: { id: cart.id, updated_at: cart.updated_at },
    items: decorated,
    totals,
  });
});

/**
 * POST /cart/items   { equipment_id, quantity? }
 */
const addItem = asyncHandler(async (req, res) => {
  const { equipment_id, quantity = 1 } = req.body;

  // Verify equipment exists, is purchasable, and has enough stock.
  const eq = await knex("equipment").where({ id: equipment_id }).first();
  if (!eq) throw new AppError("Equipment not found", 404);
  if (!["sale", "both"].includes(eq.listing_type)) {
    throw new AppError("This item is not for sale", 400);
  }
  if (eq.status !== "available") {
    throw new AppError(`This item is currently ${eq.status}`, 400);
  }
  if (eq.stock != null && quantity > eq.stock) {
    throw new AppError(`Only ${eq.stock} units in stock`, 400);
  }

  // Sanity: don't let users buy their own listings
  if (eq.owner_id === req.user.id) {
    throw new AppError("You cannot purchase your own listing", 400);
  }

  const item = await cartRepo.addItem(req.user.id, equipment_id, quantity);
  res.status(201).json({ success: true, item });
});

/**
 * PATCH /cart/items/:id   { quantity }
 */
const updateItem = asyncHandler(async (req, res) => {
  const result = await cartRepo.setItemQuantity(
    req.user.id,
    req.params.id,
    req.body.quantity,
  );
  if (!result) throw new AppError("Cart item not found", 404);
  res.json({ success: true, item: result });
});

/**
 * DELETE /cart/items/:id
 */
const removeItem = asyncHandler(async (req, res) => {
  const ok = await cartRepo.removeItem(req.user.id, req.params.id);
  if (!ok) throw new AppError("Cart item not found", 404);
  res.json({ success: true });
});

/**
 * DELETE /cart
 */
const clear = asyncHandler(async (req, res) => {
  await cartRepo.clearCart(req.user.id);
  res.json({ success: true });
});

module.exports = { get, addItem, updateItem, removeItem, clear };
