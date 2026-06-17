const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const ctrl = require("../controllers/review.controller");
const {
  createReviewValidator,
  updateReviewValidator,
  idValidator,
  equipmentIdValidator,
  listQueryValidator,
} = require("../validators/review.validator");

// Public: list reviews for an equipment
router.get(
  "/for/:equipmentId",
  equipmentIdValidator,
  listQueryValidator,
  ctrl.listForEquipment,
);

// Auth: can I review this equipment?
router.get("/can-review/:equipmentId", auth, equipmentIdValidator, ctrl.canReview);

// Auth: create/update/delete my reviews
router.post("/", auth, createReviewValidator, ctrl.create);
router.patch("/:id", auth, updateReviewValidator, ctrl.update);
router.delete("/:id", auth, idValidator, ctrl.remove);

module.exports = router;
