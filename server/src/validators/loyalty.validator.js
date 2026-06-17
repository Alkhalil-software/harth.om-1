const { query } = require("express-validator");
const { validate } = require("./auth.validator");

const historyQueryValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

module.exports = { historyQueryValidator };
