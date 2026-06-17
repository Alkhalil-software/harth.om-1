const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/payments.controller");

// Webhook is mounted in app.js at /api/v1/payments/webhook with express.raw().
// The router is mounted at that exact path, so we handle "/" here (not "/webhook")
// to avoid the effective path becoming /api/v1/payments/webhook/webhook.
router.post("/", ctrl.webhook);

module.exports = router;
