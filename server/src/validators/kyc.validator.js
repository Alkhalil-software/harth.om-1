const { body, param, query } = require("express-validator");
const { validate } = require("./auth.validator");

const submitKycValidator = [
  body("id_front_url")
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage("صورة وجه البطاقة مطلوبة"),
  body("id_back_url")
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage("صورة ظهر البطاقة مطلوبة"),
  body("selfie_url")
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage("الصورة الشخصية مطلوبة"),
  body("identity")
    .optional({ values: "falsy" })
    .isString()
    .isLength({ min: 5, max: 64 })
    .withMessage("رقم الهوية يجب أن يكون بين 5 و 64 حرفاً"),
  validate,
];

const kycListValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

const kycUserParamValidator = [
  param("userId").isUUID().withMessage("Invalid user id"),
  validate,
];

const kycRejectValidator = [
  param("userId").isUUID().withMessage("Invalid user id"),
  body("reason")
    .optional({ values: "null" })
    .isString()
    .isLength({ max: 1000 }),
  validate,
];

module.exports = {
  submitKycValidator,
  kycListValidator,
  kycUserParamValidator,
  kycRejectValidator,
};
