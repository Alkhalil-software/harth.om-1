const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const ctrl = require("../controllers/notification.controller");
const { listValidator, idValidator } = require("../validators/notification.validator");

router.get("/", auth, listValidator, ctrl.list);
router.get("/unread-count", auth, ctrl.unreadCount);
router.post("/read-all", auth, ctrl.markAllRead);
router.post("/:id/read", auth, idValidator, ctrl.markRead);

module.exports = router;
