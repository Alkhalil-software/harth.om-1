const env = require("../config/env");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

/**
 * Build the public URL for an uploaded file.
 * If PUBLIC_BASE_URL is configured, we produce an absolute URL. Otherwise
 * we return a path that clients resolve relative to their current origin.
 */
function publicUrlFor(filename) {
  const base = env.PUBLIC_BASE_URL
    ? env.PUBLIC_BASE_URL.replace(/\/+$/, "")
    : "";
  return `${base}/uploads/${filename}`;
}

/**
 * POST /uploads/image
 * Accepts a single image (field name: "image"). Returns the saved URL.
 */
const uploadSingle = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError("No file uploaded", 400);
  res.status(201).json({
    success: true,
    url: publicUrlFor(req.file.filename),
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

/**
 * POST /uploads/images
 * Accepts up to 10 images (field name: "images"). Returns an array.
 */
const uploadMultiple = asyncHandler(async (req, res) => {
  if (!req.files || !req.files.length) {
    throw new AppError("No files uploaded", 400);
  }
  const files = req.files.map((f) => ({
    url: publicUrlFor(f.filename),
    filename: f.filename,
    size: f.size,
    mimetype: f.mimetype,
  }));
  res.status(201).json({ success: true, files });
});

/**
 * POST /uploads/pdf
 * Accepts a single PDF file (field name: "pdf"). Returns the saved URL.
 * Used by equipment owners to attach manufacturer datasheets / manuals.
 */
const uploadPdf = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError("No PDF file uploaded", 400);
  res.status(201).json({
    success: true,
    url: publicUrlFor(req.file.filename),
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

module.exports = { uploadSingle, uploadMultiple, uploadPdf };
