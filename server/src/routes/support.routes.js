const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const ctrl    = require("../controllers/support.controller");

// Public (optional auth – guests can create tickets)
router.post("/tickets", auth.optionalAuth, ctrl.createTicket);

// Auth required
router.get ("/tickets/mine",         auth,              ctrl.getMyTickets);
router.get ("/tickets/:id",          auth,              ctrl.getTicket);
router.post("/tickets/:id/messages", auth,              ctrl.replyTicket);
router.post("/tickets/:id/reopen",   auth,              ctrl.reopenTicket);
router.post("/tickets/:id/rate",     auth,              ctrl.rateTicket);

// Admin
router.get  ("/admin/tickets",              auth, ctrl.adminListTickets);
router.get  ("/admin/stats",               auth, ctrl.adminStats);
router.patch("/admin/tickets/:id/status",  auth, ctrl.adminUpdateStatus);
router.patch("/admin/tickets/:id/assign",  auth, ctrl.adminAssign);

module.exports = router;
