const notificationRepo = require("../repositories/notification.repository");
const realtime = require("../services/realtime.service");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

/**
 * GET /notifications
 * Returns the caller's own in-app notifications.
 */
const list = asyncHandler(async (req, res) => {
  const { page, limit, unread_only } = req.query;
  const result = await notificationRepo.listInApp(req.user.id, {
    page,
    limit,
    unreadOnly: unread_only === "true" || unread_only === "1",
  });
  res.json({ success: true, ...result });
});

/**
 * GET /notifications/unread-count
 */
const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationRepo.unreadCount(req.user.id);
  res.json({ success: true, unread_count: count });
});

/**
 * POST /notifications/:id/read
 */
const markRead = asyncHandler(async (req, res) => {
  const row = await notificationRepo.markRead(req.params.id, req.user.id);
  if (!row) throw new AppError("Notification not found or already read", 404);

  // Push updated unread count to all the user's sockets
  const count = await notificationRepo.unreadCount(req.user.id);
  realtime.emitToUser(req.user.id, "notification:unread_count", {
    unread_count: count,
  });

  res.json({ success: true, notification: row });
});

/**
 * POST /notifications/read-all
 */
const markAllRead = asyncHandler(async (req, res) => {
  const updated = await notificationRepo.markAllRead(req.user.id);
  realtime.emitToUser(req.user.id, "notification:unread_count", {
    unread_count: 0,
  });
  res.json({ success: true, updated });
});

module.exports = { list, unreadCount, markRead, markAllRead };
