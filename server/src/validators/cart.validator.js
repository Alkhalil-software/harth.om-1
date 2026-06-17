const { body, param } = require("express-validator");
const { validate } = require("./auth.validator");

const addItemValidator = [
  body("equipment_id").isUUID().withMessage("Invalid equipment_id"),
  body("quantity")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .toInt()
    .withMessage("Quantity must be 1-1000"),
  validate,
];

const updateItemValidator = [
  param("id").isUUID().withMessage("Invalid cart item id"),
  body("quantity")
    .isInt({ min: 0, max: 1000 })
    .toInt()
    .withMessage("Quantity must be 0-1000 (0 removes the item)"),
  validate,
];

const cartItemIdValidator = [
  param("id").isUUID().withMessage("Invalid cart item id"),
  validate,
];

module.exports = {
  addItemValidator,
  updateItemValidator,
  cartItemIdValidator,
};
