const promoRepo = require("../repositories/promo.repository");
const cartRepo = require("../repositories/cart.repository");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const { computeTotals } = require("../utils/order-calculator");

/**
 * POST /promos/validate   { code }
 *
 * Previews the discount a user would get by applying this promo to their
 * current cart. Does NOT consume a use — that happens only on successful
 * order creation.
 */
const validate = asyncHandler(async (req, res) => {
  const code = (req.body.code || "").trim();
  if (!code) throw new AppError("Promo code required", 400);

  const promo = await promoRepo.findValidByCode(code);
  if (!promo) {
    throw new AppError("Invalid or expired promo code", 404);
  }

  // Preview against the user's current cart so they see the real impact.
  const { items } = await cartRepo.getCartWithItems(req.user.id);
  const purchasable = items.filter(
    (i) => ["sale", "both"].includes(i.listing_type) && i.status === "available",
  );
  const priced = purchasable.map((i) => ({
    price_per_unit: i.sale_price != null ? Number(i.sale_price) : 0,
    quantity: i.quantity,
  }));

  const totals = computeTotals({ items: priced, promo });

  if (promo.min_order_total != null && totals.subtotal < Number(promo.min_order_total)) {
    return res.json({
      success: true,
      valid: false,
      reason: `Minimum order of ${promo.min_order_total} required`,
      promo: {
        code: promo.code,
        type: promo.type,
        value: Number(promo.value),
        min_order_total: Number(promo.min_order_total),
      },
      totals,
    });
  }

  res.json({
    success: true,
    valid: true,
    promo: {
      code: promo.code,
      type: promo.type,
      value: Number(promo.value),
      max_discount:
        promo.max_discount != null ? Number(promo.max_discount) : null,
    },
    totals,
  });
});

module.exports = { validate };
