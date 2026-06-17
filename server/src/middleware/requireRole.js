const { AppError } = require("./errorHandler");

/**
 * Gate routes by role. Usage: router.post('/', auth, requireRole('owner','admin'), handler).
 * Must run *after* the `auth` middleware so req.user exists.
 */
function requireRole(...allowedRoles) {
  return function (req, _res, next) {
    if (!req.user) return next(new AppError("Not authenticated", 401));
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(`Role '${req.user.role}' is not permitted here`, 403),
      );
    }
    return next();
  };
}

module.exports = requireRole;
