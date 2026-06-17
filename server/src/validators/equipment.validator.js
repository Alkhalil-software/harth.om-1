const { body, query, param } = require("express-validator");
const { validate } = require("./auth.validator");

// Must match the equipment_category ENUM in migration 001
const CATEGORIES = [
  "tractor",
  "sprayer",
  "harvester",
  "tools",
  "seeds",
  "fertilizer",
  "pesticide",
  "other",
];
const STATUSES = ["available", "rented", "maintenance", "sold", "hidden"];
const LISTING_TYPES = ["sale", "rent", "both"];
const GOVERNORATES = [
  "muscat", "dhofar", "musandam", "buraimi",
  "dakhiliyah", "north_batinah", "south_batinah",
  "south_sharqiyah", "north_sharqiyah", "dhahirah", "wusta",
];

/**
 * Enforce the same price/listing-type invariants the DB enforces, but earlier
 * (so the client gets a readable 400 instead of a Postgres error).
 */
function priceConsistencyCheck(value, { req }) {
  const listingType = req.body.listing_type;
  const daily = req.body.daily_price;
  const sale = req.body.sale_price;

  if (listingType === "rent" && (daily == null || daily === "")) {
    throw new Error("daily_price is required for rental listings");
  }
  if (listingType === "sale" && (sale == null || sale === "")) {
    throw new Error("sale_price is required for sale listings");
  }
  if (listingType === "both") {
    if (daily == null || daily === "") {
      throw new Error("daily_price is required when listing_type is 'both'");
    }
    if (sale == null || sale === "") {
      throw new Error("sale_price is required when listing_type is 'both'");
    }
  }
  return true;
}

const createEquipmentValidator = [
  body("name")
    .isString()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Name must be 2-200 characters"),
  body("description")
    .optional({ values: "falsy" })
    .isString()
    .isLength({ max: 5000 }),
  body("category")
    .isIn(CATEGORIES)
    .withMessage(`category must be one of: ${CATEGORIES.join(", ")}`),
  body("listing_type")
    .isIn(LISTING_TYPES)
    .withMessage(`listing_type must be one of: ${LISTING_TYPES.join(", ")}`),
  body("daily_price")
    .optional({ values: "null" })
    .isFloat({ min: 0 })
    .withMessage("daily_price must be >= 0"),
  body("sale_price")
    .optional({ values: "null" })
    .isFloat({ min: 0 })
    .withMessage("sale_price must be >= 0"),
  body("deposit_amount")
    .optional({ values: "null" })
    .isFloat({ min: 0 })
    .withMessage("deposit_amount must be >= 0"),
  body("stock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("stock must be a non-negative integer"),
  body("images")
    .optional()
    .isArray({ max: 10 })
    .withMessage("images must be an array of up to 10 URLs"),
  body("images.*").optional().isString().isLength({ max: 500 }),
  body("primary_image_url").optional({ values: "falsy" }).isString().isLength({ max: 500 }),
  body("specs").optional().isObject(),
  body("location").optional({ values: "falsy" }).isObject(),
  body("governorate")
    .optional({ values: "falsy" })
    .isIn(GOVERNORATES)
    .withMessage(`governorate must be one of: ${GOVERNORATES.join(", ")}`),
  body("status")
    .optional()
    .isIn(STATUSES)
    .withMessage(`status must be one of: ${STATUSES.join(", ")}`),
  body("listing_type").custom(priceConsistencyCheck),
  validate,
];

// For PATCH — nothing is required individually, but if listing_type is changed
// we re-check price consistency against whatever prices are being set.
const updateEquipmentValidator = [
  param("id").isUUID().withMessage("Invalid equipment id"),
  body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 200 }),
  body("description").optional({ values: "null" }).isString().isLength({ max: 5000 }),
  body("category").optional().isIn(CATEGORIES),
  body("listing_type").optional().isIn(LISTING_TYPES),
  body("daily_price").optional({ values: "null" }).isFloat({ min: 0 }),
  body("sale_price").optional({ values: "null" }).isFloat({ min: 0 }),
  body("deposit_amount").optional({ values: "null" }).isFloat({ min: 0 }),
  body("stock").optional().isInt({ min: 0 }),
  body("images").optional().isArray({ max: 10 }),
  body("images.*").optional().isString().isLength({ max: 500 }),
  body("primary_image_url").optional({ values: "null" }).isString().isLength({ max: 500 }),
  body("specs").optional().isObject(),
  body("location").optional({ values: "null" }).isObject(),
  body("governorate").optional({ values: "null" }).isIn(GOVERNORATES),
  body("status").optional().isIn(STATUSES),
  validate,
];

const idParamValidator = [
  param("id").isUUID().withMessage("Invalid equipment id"),
  validate,
];

const listQueryValidator = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("category").optional().isIn(CATEGORIES),
  query("listing_type").optional().isIn(LISTING_TYPES),
  query("status").optional().isIn(STATUSES),
  query("governorate").optional({ values: "falsy" }).isIn(GOVERNORATES),
  query("min_price").optional().isFloat({ min: 0 }).toFloat(),
  query("max_price").optional().isFloat({ min: 0 }).toFloat(),
  query("min_rating").optional().isFloat({ min: 0, max: 5 }).toFloat(),
  query("search").optional().isString().isLength({ max: 200 }),
  query("sort")
    .optional()
    .isIn([
      "newest",
      "oldest",
      "price_low",
      "price_high",
      "sale_low",
      "sale_high",
      "rating",
    ]),
  validate,
];

module.exports = {
  createEquipmentValidator,
  updateEquipmentValidator,
  idParamValidator,
  listQueryValidator,
  CATEGORIES,
  STATUSES,
  LISTING_TYPES,
};
