const { body } = require("express-validator");
const { validate } = require("./auth.validator");

const validatePromoValidator = [
  body("code").isString().trim().isLength({ min: 1, max: 32 }).withMessage("Code required"),
  validate,
];

module.exports = { validatePromoValidator };
