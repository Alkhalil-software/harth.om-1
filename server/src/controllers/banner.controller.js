const bannerRepo = require("../repositories/banner.repository");
const auditService = require("../services/audit.service");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

/**
 * Public: list live banners. Optional ?placement= filter so the
 * homepage only fetches its hero strip while tools.html only fetches
 * its top strip.
 *
 * Cached briefly so an admin's "publish" lands within a minute. We
 * don't go full-realtime here — banners change at the day/week scale,
 * not the second.
 */
const listLive = asyncHandler(async (req, res) => {
  const { placement } = req.query;
  const items = await bannerRepo.listLive({ placement: placement || null });
  res.set("Cache-Control", "public, max-age=60");
  res.json({ success: true, items });
});

/**
 * Admin: full list (any state, any placement).
 */
const listAll = asyncHandler(async (req, res) => {
  const { page, limit, placement } = req.query;
  const result = await bannerRepo.listAll({
    page,
    limit,
    placement: placement || null,
  });
  res.json({ success: true, ...result });
});

const getOne = asyncHandler(async (req, res) => {
  const row = await bannerRepo.getById(req.params.id);
  if (!row) throw new AppError("Banner not found", 404);
  res.json({ success: true, banner: row });
});

const create = asyncHandler(async (req, res) => {
  const row = await bannerRepo.create(req.body, { createdBy: req.user.id });
  auditService.record(req, {
    action: "banner_created",
    targetType: "banner",
    targetId: row.id,
    after: { title: row.title, placement: row.placement, is_active: row.is_active },
  });
  res.status(201).json({ success: true, banner: row });
});

const update = asyncHandler(async (req, res) => {
  const before = await bannerRepo.getById(req.params.id);
  if (!before) throw new AppError("Banner not found", 404);
  const row = await bannerRepo.update(req.params.id, req.body);
  auditService.record(req, {
    action: "banner_updated",
    targetType: "banner",
    targetId: row.id,
    before: {
      title: before.title,
      is_active: before.is_active,
      placement: before.placement,
    },
    after: {
      title: row.title,
      is_active: row.is_active,
      placement: row.placement,
    },
  });
  res.json({ success: true, banner: row });
});

const remove = asyncHandler(async (req, res) => {
  const before = await bannerRepo.getById(req.params.id);
  if (!before) throw new AppError("Banner not found", 404);
  const ok = await bannerRepo.remove(req.params.id);
  if (!ok) throw new AppError("Banner not found", 404);
  auditService.record(req, {
    action: "banner_deleted",
    targetType: "banner",
    targetId: req.params.id,
    before: { title: before.title, placement: before.placement },
  });
  res.json({ success: true });
});

module.exports = {
  listLive,
  listAll,
  getOne,
  create,
  update,
  remove,
};
