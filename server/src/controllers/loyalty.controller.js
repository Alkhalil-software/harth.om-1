const loyaltyRepo = require("../repositories/loyalty.repository");
const tierService = require("../services/loyalty-tier.service");
const { asyncHandler } = require("../middleware/errorHandler");

/**
 * GET /loyalty
 * Returns the caller's current balance + paginated ledger.
 */
const getMine = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await loyaltyRepo.getBalanceAndHistory(req.user.id, {
    page,
    limit,
  });
  res.json({ success: true, ...result });
});

/**
 * GET /loyalty/me/tier
 * Returns the caller's current tier + progress toward the next tier.
 * Powers the "My Loyalty" widget on the user's dashboard.
 */
const getMyTier = asyncHandler(async (req, res) => {
  const tier = await tierService.getTierForUser(req.user.id);
  res.json({ success: true, ...tier });
});

/**
 * GET /loyalty/tiers
 * Public-ish (auth required). The list of all tiers + thresholds, so
 * the frontend can render a static comparison table without baking the
 * thresholds into the client.
 */
const listTiers = asyncHandler(async (_req, res) => {
  res.json({ success: true, tiers: tierService.TIERS });
});

/**
 * POST /loyalty/sweep
 * Admin-only: run the expiry sweep immediately. Normally called by a cron
 * job (we expose the endpoint so ops can run it ad-hoc).
 */
const sweep = asyncHandler(async (_req, res) => {
  const result = await loyaltyRepo.expireStalePoints();
  res.json({ success: true, ...result });
});

module.exports = { getMine, getMyTier, listTiers, sweep };
