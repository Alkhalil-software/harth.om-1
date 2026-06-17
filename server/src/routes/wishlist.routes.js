const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const ctrl = require("../controllers/wishlist.controller");
const {
  addValidator,
  equipmentIdParamValidator,
  listQueryValidator,
} = require("../validators/wishlist.validator");

router.get("/", auth, listQueryValidator, ctrl.list);
router.post("/", auth, addValidator, ctrl.add);
router.get("/check/:equipmentId", auth, equipmentIdParamValidator, ctrl.check);
router.delete("/:equipmentId", auth, equipmentIdParamValidator, ctrl.remove);

module.exports = router;
