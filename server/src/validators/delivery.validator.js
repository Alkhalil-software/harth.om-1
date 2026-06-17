const { body, param, query } = require("express-validator");
const { validate } = require("./auth.validator");

const createDeliveryValidator = [
  body("rental_id").optional({ values: "falsy" }).isUUID(),
  body("order_id").optional({ values: "falsy" }).isUUID(),
  body("pickup_address").isObject().withMessage("pickup_address must be an object"),
  body("pickup_address.city").isString().isLength({ min: 2, max: 100 }),
  body("dropoff_address").isObject().withMessage("dropoff_address must be an object"),
  body("dropoff_address.city").isString().isLength({ min: 2, max: 100 }),
  body("scheduled_date")
    .optional({ values: "falsy" })
    .matches(/^\d{4}-\d{2}-\d{2}$/),
  body("fee").optional().isFloat({ min: 0 }).toFloat(),
  body("notes").optional({ values: "null" }).isString().isLength({ max: 2000 }),
  // Exactly one link (mirrors the DB CHECK)
  body().custom((_v, { req }) => {
    const hasRental = !!req.body.rental_id;
    const hasOrder = !!req.body.order_id;
    if (hasRental === hasOrder) {
      throw new Error("Provide exactly one of rental_id or order_id");
    }
    return true;
  }),
  validate,
];

const deliveryIdValidator = [
  param("id").isUUID().withMessage("Invalid delivery id"),
  validate,
];

const transitionValidator = [
  param("id").isUUID().withMessage("Invalid delivery id"),
  body("notes").optional({ values: "null" }).isString().isLength({ max: 2000 }),
  body("proof_images").optional().isArray({ max: 5 }),
  body("proof_images.*").optional().isString().isLength({ min: 1, max: 500 }),
  // GPS location captured by the courier's device at proof time
  body("proof_location").optional({ values: "null" }).isObject(),
  body("proof_location.lat").optional().isFloat({ min: -90, max: 90 }),
  body("proof_location.lng").optional().isFloat({ min: -180, max: 180 }),
  body("proof_location.accuracy").optional().isFloat({ min: 0 }),
  // ISO timestamp from client (used for freshness check — must be within 5 min)
  body("proof_location.client_ts").optional().isISO8601(),
  validate,
];

const listQueryValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("scope")
    .optional()
    .isIn(["available", "mine", "owner", "customer", "admin"]),
  query("status")
    .optional()
    .isIn(["pending", "accepted", "picked_up", "in_transit", "delivered", "cancelled"]),
  query("order_id").optional({ values: "falsy" }).isUUID(),
  validate,
];

module.exports = {
  createDeliveryValidator,
  deliveryIdValidator,
  transitionValidator,
  listQueryValidator,
};
