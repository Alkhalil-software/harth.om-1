const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const ctrl = require("../controllers/promo.controller");
const { validatePromoValidator } = require("../validators/promo.validator");

router.post("/validate", auth, validatePromoValidator, ctrl.validate);

module.exports = router;
