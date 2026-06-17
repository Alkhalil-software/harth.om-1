const { body, param, query } = require("express-validator");
const { validate } = require("./auth.validator");

const sendValidator = [
  body("recipient_id").isUUID().withMessage("Invalid recipient_id"),
  body("body")
    .isString()
    .trim()
    .isLength({ min: 1, max: 4000 })
    .withMessage("body must be 1-4000 characters"),
  body("attachment_url")
    .optional({ values: "falsy" })
    .isURL({ require_tld: false })
    .withMessage("attachment_url must be a valid URL")
    .isLength({ max: 500 }),
  validate,
];

const peerIdValidator = [
  param("peerId").isUUID().withMessage("Invalid peer id"),
  validate,
];

const listQueryValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 200 }).toInt(),
  validate,
];

module.exports = { sendValidator, peerIdValidator, listQueryValidator };
