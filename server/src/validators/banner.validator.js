const { body, param, query } = require("express-validator");
const { validate } = require("./auth.validator");

const PLACEMENTS = [
  "home_hero",
  "home_secondary",
  "tools_top",
  "global_top_strip",
];

const createBannerValidator = [
  body("title").isString().trim().isLength({ min: 1, max: 200 }),
  body("subtitle").optional({ values: "null" }).isString().isLength({ max: 400 }),
  body("image_url").optional({ values: "null" }).isString().isLength({ max: 500 }),
  body("cta_label").optional({ values: "null" }).isString().isLength({ max: 80 }),
  body("cta_url").optional({ values: "null" }).isString().isLength({ max: 500 }),
  body("placement").optional().isIn(PLACEMENTS),
  body("active_from").optional({ values: "null" }).isISO8601(),
  body("active_until").optional({ values: "null" }).isISO8601(),
  body("is_active").optional().isBoolean(),
  body("sort_order").optional().isInt({ min: -1000, max: 1000 }).toInt(),
  body("background_color")
    .optional({ values: "null" })
    .isString()
    .isLength({ max: 32 }),
  body("text_color")
    .optional({ values: "null" })
    .isString()
    .isLength({ max: 32 }),
  body("promo_code").optional({ values: "null" }).isString().isLength({ max: 32 }),
  validate,
];

const updateBannerValidator = [
  param("id").isUUID(),
  body("title").optional().isString().trim().isLength({ min: 1, max: 200 }),
  body("subtitle").optional({ values: "null" }).isString().isLength({ max: 400 }),
  body("image_url").optional({ values: "null" }).isString().isLength({ max: 500 }),
  body("cta_label").optional({ values: "null" }).isString().isLength({ max: 80 }),
  body("cta_url").optional({ values: "null" }).isString().isLength({ max: 500 }),
  body("placement").optional().isIn(PLACEMENTS),
  body("active_from").optional({ values: "null" }).isISO8601(),
  body("active_until").optional({ values: "null" }).isISO8601(),
  body("is_active").optional().isBoolean(),
  body("sort_order").optional().isInt({ min: -1000, max: 1000 }).toInt(),
  body("background_color")
    .optional({ values: "null" })
    .isString()
    .isLength({ max: 32 }),
  body("text_color")
    .optional({ values: "null" })
    .isString()
    .isLength({ max: 32 }),
  body("promo_code").optional({ values: "null" }).isString().isLength({ max: 32 }),
  validate,
];

const bannerIdValidator = [
  param("id").isUUID().withMessage("Invalid banner id"),
  validate,
];

const bannerListValidator = [
  query("placement").optional().isIn(PLACEMENTS),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

module.exports = {
  PLACEMENTS,
  createBannerValidator,
  updateBannerValidator,
  bannerIdValidator,
  bannerListValidator,
};
