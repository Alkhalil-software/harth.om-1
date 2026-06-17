const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const ctrl = require("../controllers/loyalty.controller");
const { historyQueryValidator } = require("../validators/loyalty.validator");

router.get("/", auth, historyQueryValidator, ctrl.getMine);
// Tier introspection: per-user state + the static tier list. Both
// require auth so we don't have to think about anonymous behavior.
router.get("/me/tier", auth, ctrl.getMyTier);
router.get("/tiers", auth, ctrl.listTiers);
router.post("/sweep", auth, requireRole("admin"), ctrl.sweep);

module.exports = router;
