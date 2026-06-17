const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const ctrl = require("../controllers/cart.controller");
const {
  addItemValidator,
  updateItemValidator,
  cartItemIdValidator,
} = require("../validators/cart.validator");

// All cart routes require authentication. Any role can have a cart
// (even owners may buy from other owners).

router.get("/", auth, ctrl.get);
router.post("/items", auth, addItemValidator, ctrl.addItem);
router.patch("/items/:id", auth, updateItemValidator, ctrl.updateItem);
router.delete("/items/:id", auth, cartItemIdValidator, ctrl.removeItem);
router.delete("/", auth, ctrl.clear);

module.exports = router;
