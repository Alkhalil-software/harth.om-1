const { body, param, query } = require("express-validator");
const { validate } = require("./auth.validator");

const createOrderValidator = [
  body("shipping_address")
    .isObject()
    .withMessage("shipping_address must be an object"),
  body("shipping_address.street").optional().isString().isLength({ max: 300 }),
  body("shipping_address.city").isString().isLength({ min: 2, max: 100 }),
  body("shipping_address.phone").optional().isString().isLength({ max: 32 }),
  body("shipping_address.lat").optional().isFloat(),
  body("shipping_address.lng").optional().isFloat(),
  body("payment_method")
    .optional()
    .isIn(["card", "cash_on_delivery"])
    .withMessage("payment_method must be card or cash_on_delivery"),
  body("promo_code")
    .optional({ values: "falsy" })
    .isString()
    .trim()
    .isLength({ max: 32 }),
  body("loyalty_points")
    .optional()
    .isInt({ min: 0 })
    .toInt(),
  body("shipping_fee")
    .optional()
    .isFloat({ min: 0 })
    .toFloat(),
  body("notes").optional({ values: "null" }).isString().isLength({ max: 2000 }),
  validate,
];

const orderIdValidator = [
  param("id").isUUID().withMessage("Invalid order id"),
  validate,
];

const trackingValidator = [
  param("tracking").isString().matches(/^(HRT|IJ)-[A-Z0-9]{4,20}$/i),
  validate,
];

const listQueryValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

module.exports = {
  createOrderValidator,
  orderIdValidator,
  trackingValidator,
  listQueryValidator,
};
