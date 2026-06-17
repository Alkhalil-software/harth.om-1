const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const env = require("../config/env");
const { AppError } = require("./errorHandler");

// Ensure the upload directory exists on boot. Synchronous is fine — it runs once.
if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}

// Whitelist actual image types we accept. We check the declared MIME AND the
// extension — a stricter check would sniff magic bytes, but that requires
// buffering the file first.
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const ALLOWED_MIME_PDF = new Set(["application/pdf"]);
const ALLOWED_EXT_PDF  = new Set([".pdf"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // 16 bytes of random = 32 hex chars. Collision-free for our purposes.
    const id = crypto.randomBytes(16).toString("hex");
    cb(null, `${Date.now()}-${id}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
    return cb(new AppError("Unsupported file type", 400));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.UPLOAD_MAX_BYTES,
    files: 10,
  },
});

function fileFilterPDF(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_PDF.has(file.mimetype) || !ALLOWED_EXT_PDF.has(ext)) {
    return cb(new AppError("Only PDF files are accepted", 400));
  }
  cb(null, true);
}

const uploadPDF = multer({
  storage,
  fileFilter: fileFilterPDF,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB cap for datasheets
    files: 1,
  },
});

/**
 * Wrap multer so its errors come through our AppError pipeline as 400s
 * instead of 500s.
 */
function wrap(mw) {
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        return next(new AppError(`Upload error: ${err.message}`, 400));
      }
      return next(err);
    });
  };
}

module.exports = {
  single:    (field)       => wrap(upload.single(field)),
  array:     (field, max)  => wrap(upload.array(field, max ?? 10)),
  singlePdf: (field)       => wrap(uploadPDF.single(field)),
};
