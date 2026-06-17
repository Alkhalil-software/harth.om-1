/**
 * Pure order-math utilities. No DB, no I/O. Easy to unit test.
 *
 * All money values are kept as decimal numbers rounded to 2 places at every
 * step to mirror what Postgres will store (NUMERIC(12,2)). JS binary floats
 * are fine here because our amounts are small and we round aggressively.
 */

const TAX_RATE = 0.10; // 10% as per product spec. Later: move to DB config.

/**
 * Round half-up to 2 decimals. `0.1 + 0.2` gives 0.30 reliably.
 */
function money(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate a single line's total from unit price and quantity.
 * Separate helper so order_items.line_total is computed the same way everywhere.
 */
function lineTotal(pricePerUnit, quantity) {
  return money(Number(pricePerUnit) * Number(quantity));
}

/**
 * Compute the discount for a given promo and subtotal.
 * Enforces min_order_total and max_discount caps, and clamps the result so
 * the discount never exceeds the subtotal.
 *
 * Returns 0 for any invalid combination — the caller decides whether to
 * reject the code entirely or apply 0 silently.
 */
function computeDiscount(promo, subtotal) {
  if (!promo) return 0;

  const sub = money(subtotal);
  if (promo.min_order_total != null && sub < Number(promo.min_order_total)) {
    return 0;
  }

  let discount;
  if (promo.type === "percentage") {
    discount = (sub * Number(promo.value)) / 100;
  } else if (promo.type === "fixed") {
    discount = Number(promo.value);
  } else {
    return 0;
  }

  if (promo.max_discount != null) {
    discount = Math.min(discount, Number(promo.max_discount));
  }
  // Discount can never exceed subtotal.
  discount = Math.min(discount, sub);
  discount = Math.max(discount, 0);
  return money(discount);
}

/**
 * Main totals calculator.
 *
 * Tax is computed on (subtotal - discount), which is the standard approach
 * and keeps the math consistent with how most commerce platforms bill.
 * Shipping is added after tax (tax-free shipping, the simple default).
 *
 * Loyalty points are applied as a final reduction, capped at 50% of the
 * pre-loyalty total as per product spec.
 *
 * @returns {{
 *   subtotal: number,
 *   discount: number,
 *   tax: number,
 *   shipping_fee: number,
 *   loyalty_points_used: number,
 *   total: number,
 *   loyalty_points_earned: number,
 * }}
 */
function computeTotals({
  items, // [{ price_per_unit, quantity }]
  promo = null,
  shippingFee = 0,
  loyaltyPointsRequested = 0, // 1 point = 1 OMR
  userLoyaltyBalance = 0, // from DB
} = {}) {
  // Subtotal — sum of line totals
  const subtotal = money(
    (items || []).reduce(
      (sum, it) => sum + lineTotal(it.price_per_unit, it.quantity),
      0,
    ),
  );

  const discount = computeDiscount(promo, subtotal);
  const taxable = Math.max(subtotal - discount, 0);
  const tax = money(taxable * TAX_RATE);
  const shipping = money(Math.max(Number(shippingFee) || 0, 0));

  const preLoyaltyTotal = money(subtotal - discount + tax + shipping);

  // Loyalty cap: at most 50% of the current total, at most the user's balance,
  // at most what they requested, never negative.
  const loyaltyCap = money(preLoyaltyTotal * 0.5);
  const loyaltyUsed = money(
    Math.max(
      0,
      Math.min(
        Number(loyaltyPointsRequested) || 0,
        Number(userLoyaltyBalance) || 0,
        loyaltyCap,
      ),
    ),
  );

  const total = money(Math.max(preLoyaltyTotal - loyaltyUsed, 0));

  // Points earned: 1 OMR = 1 point on the final total (excluding loyalty use).
  // We earn on what the user actually paid, not on what was discounted away.
  const pointsEarned = Math.floor(total);

  return {
    subtotal,
    discount,
    tax,
    shipping_fee: shipping,
    loyalty_points_used: loyaltyUsed,
    total,
    loyalty_points_earned: pointsEarned,
  };
}

module.exports = {
  TAX_RATE,
  money,
  lineTotal,
  computeDiscount,
  computeTotals,
};
