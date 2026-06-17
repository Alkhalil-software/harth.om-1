const { body, param } = require("express-validator");
const { validate } = require("./auth.validator");

const createStoryValidator = [
  body("image_url")
    .isString()
    .isLength({ min: 1, max: 500 })
    .withMessage("صورة القصة مطلوبة"),
  body("caption")
    .optional({ values: "falsy" })
    .isString()
    .isLength({ max: 280 })
    .withMessage("التعليق لا يتجاوز 280 حرفاً"),
  body("equipment_id")
    .optional({ values: "falsy" })
    .isUUID()
    .withMessage("Invalid equipment id"),
  validate,
];

const storyIdValidator = [
  param("id").isUUID().withMessage("Invalid story id"),
  validate,
];

const authorIdValidator = [
  param("authorId").isUUID().withMessage("Invalid author id"),
  validate,
];

module.exports = {
  createStoryValidator,
  storyIdValidator,
  authorIdValidator,
};
