const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const requireApprovedAccount = require("../middleware/requireApprovedAccount");
const ctrl = require("../controllers/delivery.controller");
const {
  createDeliveryValidator,
  deliveryIdValidator,
  transitionValidator,
  listQueryValidator,
} = require("../validators/delivery.validator");

// Anyone authenticated can list deliveries they have a role in (scope-filtered)
router.get("/", auth, listQueryValidator, ctrl.list);

// Create a delivery request — party to the rental/order
router.post("/", auth, createDeliveryValidator, ctrl.create);

// Single delivery
router.get("/:id", auth, deliveryIdValidator, ctrl.getOne);

// Courier-only state transitions. requireRole ensures only delivery/admin
// can hit these; requireApprovedAccount enforces the spec rule:
//   "لا يمكنه قبول أي طلب توصيل إلا بعد موافقة الأدمن"
// the controller still enforces that THIS courier is the assignee.
router.post(
  "/:id/accept",
  auth,
  requireRole("delivery", "admin"),
  requireApprovedAccount,
  deliveryIdValidator,
  ctrl.accept,
);
router.post(
  "/:id/pickup",
  auth,
  requireRole("delivery", "admin"),
  requireApprovedAccount,
  transitionValidator,
  ctrl.pickup,
);
router.post(
  "/:id/in-transit",
  auth,
  requireRole("delivery", "admin"),
  requireApprovedAccount,
  transitionValidator,
  ctrl.inTransit,
);
router.post(
  "/:id/delivered",
  auth,
  requireRole("delivery", "admin"),
  requireApprovedAccount,
  transitionValidator,
  ctrl.markDelivered,
);
router.post(
  "/:id/cancel",
  auth,
  requireRole("delivery", "admin"),
  requireApprovedAccount,
  transitionValidator,
  ctrl.cancel,
);

module.exports = router;
