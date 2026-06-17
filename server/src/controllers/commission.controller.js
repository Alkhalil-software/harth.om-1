const commissionRepo = require("../repositories/commission.repository");
const { asyncHandler } = require("../middleware/errorHandler");

/**
 * GET /commissions/mine
 * Owner sees their own earnings summary + history.
 */
const listMine = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const result = await commissionRepo.listForOwner(req.user.id, {
    page,
    limit,
    status,
  });
  res.json({ success: true, ...result });
});

module.exports = { listMine };
