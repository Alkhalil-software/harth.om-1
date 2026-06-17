const { body, param, query } = require("express-validator");
const { validate } = require("./auth.validator");

const createReviewValidator = [
  body("equipment_id").isUUID().withMessage("Invalid equipment_id"),
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("rating must be an integer 1..5")
    .toInt(),
  body("comment")
    .optional({ values: "falsy" })
    .isString()
    .isLength({ max: 2000 }),
  validate,
];

const updateReviewValidator = [
  param("id").isUUID().withMessage("Invalid review id"),
  body("rating").optional().isInt({ min: 1, max: 5 }).toInt(),
  body("comment").optional({ values: "null" }).isString().isLength({ max: 2000 }),
  validate,
];

const idValidator = [
  param("id").isUUID().withMessage("Invalid review id"),
  validate,
];

const equipmentIdValidator = [
  param("equipmentId").isUUID().withMessage("Invalid equipment id"),
  validate,
];

const listQueryValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

module.exports = {
  createReviewValidator,
  updateReviewValidator,
  idValidator,
  equipmentIdValidator,
  listQueryValidator,
};
