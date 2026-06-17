// Centralized error handling + AppError class

/**
 * AppError - operational errors we throw ourselves (known).
 * Anything else is treated as programmer error.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Wraps async route handlers so thrown/rejected errors hit the handler below.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Global error handler. Must have 4 args for Express to treat it as error mw.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Postgres unique violation -> 409
  if (err.code === "23505") {
    return res.status(409).json({
      error: {
        code: 409,
        message: "Duplicate value violates unique constraint",
      },
    });
  }
  // Postgres FK violation
  if (err.code === "23503") {
    return res.status(400).json({
      error: { code: 400, message: "Referenced record does not exist" },
    });
  }
  // Postgres check violation
  if (err.code === "23514") {
    return res.status(400).json({
      error: { code: 400, message: "Value violates a check constraint" },
    });
  }

  const statusCode = err.statusCode || 500;
  const payload = {
    error: {
      code: statusCode,
      message: err.message || "Internal Server Error",
    },
  };
  if (err.details) payload.error.details = err.details;

  // Log server errors (not client errors)
  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error("[error]", err);
  }

  res.status(statusCode).json(payload);
};

module.exports = errorHandler;
module.exports.AppError = AppError;
module.exports.asyncHandler = asyncHandler;
