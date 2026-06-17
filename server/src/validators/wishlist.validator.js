const { body, param, query } = require("express-validator");
const { validate } = require("./auth.validator");

const addValidator = [
  body("equipment_id").isUUID().withMessage("Invalid equipment_id"),
  validate,
];

const equipmentIdParamValidator = [
  param("equipmentId").isUUID().withMessage("Invalid equipment id"),
  validate,
];

const listQueryValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("search").optional({ values: "falsy" }).isString().isLength({ max: 200 }),
  query("category").optional({ values: "falsy" }).isString().isLength({ max: 100 }),
  query("listing_type").optional({ values: "falsy" }).isIn(["sale", "rent", "both"]),
  validate,
];

module.exports = { addValidator, equipmentIdParamValidator, listQueryValidator };
