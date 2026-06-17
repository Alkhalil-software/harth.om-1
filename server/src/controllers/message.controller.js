const knex = require("../db");
const messageRepo = require("../repositories/message.repository");
const realtime = require("../services/realtime.service");
const notificationService = require("../services/notification.service");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

/**
 * POST /messages
 * Send a direct message and push it via realtime to both parties.
 */
const send = asyncHandler(async (req, res) => {
  const { recipient_id, body, attachment_url = null } = req.body;

  if (recipient_id === req.user.id) {
    throw new AppError("Cannot message yourself", 400);
  }

  // Verify the recipient exists & is active. Without this we'd just insert
  // a row that nobody could read.
  const recipient = await knex("users")
    .where({ id: recipient_id, is_active: true })
    .first("id", "name");
  if (!recipient) throw new AppError("Recipient not found", 404);

  const message = await messageRepo.send({
    senderId: req.user.id,
    recipientId: recipient_id,
    body,
    attachmentUrl: attachment_url,
  });

  // Push to recipient (every connected socket)
  realtime.emitToUser(recipient_id, "message:new", message);
  // Push back to sender's OTHER devices (so a message composed on the phone
  // instantly appears on their laptop too).
  realtime.emitToUser(req.user.id, "message:new", message);

  // Also create an in-app notification for the recipient so it shows up in
  // the bell even if they don't have chat open right now.
  const preview = message.body.length > 80
    ? message.body.slice(0, 77) + "..."
    : message.body;
  // Fire-and-forget — don't block the response on it.
  notificationService.events
    .newMessage(recipient_id, req.user.id, req.user.name || "مستخدم", preview)
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[message notify failed]", e.message);
    });

  res.status(201).json({ success: true, message });
});

/**
 * GET /messages/conversations
 * Inbox-style list of the caller's conversations.
 */
const listConversations = asyncHandler(async (req, res) => {
  const conversations = await messageRepo.listConversations(req.user.id, {
    limit: req.query.limit,
  });
  res.json({ success: true, conversations });
});

/**
 * GET /messages/with/:peerId
 * Full history with one peer, paginated.
 */
const getConversation = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await messageRepo.getConversation(req.user.id, req.params.peerId, {
    page,
    limit,
  });
  res.json({ success: true, ...result });
});

/**
 * POST /messages/with/:peerId/read
 * Mark all messages from this peer as read.
 */
const markRead = asyncHandler(async (req, res) => {
  const updated = await messageRepo.markConversationRead({
    readerId: req.user.id,
    peerId: req.params.peerId,
  });

  // Notify the peer that their messages were read.
  if (updated.length) {
    realtime.emitToUser(req.params.peerId, "message:read", {
      reader_id: req.user.id,
      message_ids: updated.map((m) => m.id),
    });
  }

  res.json({ success: true, marked: updated.length });
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await messageRepo.unreadCount(req.user.id);
  res.json({ success: true, unread_count: count });
});

/**
 * GET /messages/presence/:peerId
 * Returns whether the peer currently has an active socket.
 */
const peerPresence = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user_id: req.params.peerId,
    online: realtime.isOnline(req.params.peerId),
  });
});

module.exports = {
  send,
  listConversations,
  getConversation,
  markRead,
  unreadCount,
  peerPresence,
};
