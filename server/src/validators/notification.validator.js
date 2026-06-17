const { param, query } = require("express-validator");
const { validate } = require("./auth.validator");

const listValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("unread_only").optional().isIn(["true", "false", "0", "1"]),
  validate,
];

const idValidator = [
  param("id").isUUID().withMessage("Invalid notification id"),
  validate,
];

module.exports = { listValidator, idValidator };
