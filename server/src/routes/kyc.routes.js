const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const ctrl = require("../controllers/kyc.controller");
const {
  submitKycValidator,
} = require("../validators/kyc.validator");

// All KYC self-service routes require auth. Anyone authenticated can submit
// KYC — owners/delivery agents NEED to to operate, renters MAY for the
// verified badge.

// GET /api/v1/kyc/me - read my KYC state
router.get("/me", auth, ctrl.getMyKyc);

// POST /api/v1/kyc/submit - submit documents for review
router.post("/submit", auth, submitKycValidator, ctrl.submitKyc);

module.exports = router;
