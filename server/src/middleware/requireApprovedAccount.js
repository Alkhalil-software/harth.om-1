const { AppError } = require("./errorHandler");

/**
 * Gate routes that require an APPROVED account. Used in addition to
 * requireRole — e.g. a farmer (owner) is only allowed to list equipment
 * once an admin has approved their account. A delivery agent is only
 * allowed to accept jobs once an admin has approved their account.
 *
 * Admins are always considered approved. Pending/rejected users are
 * allowed to log in and browse/buy but are blocked here.
 *
 * Usage: router.post('/', auth, requireRole('owner','admin'), requireApprovedAccount, handler)
 *
 * Must run *after* the `auth` middleware so req.user exists. The auth
 * middleware already rejects 'blocked' and 'deleted' users globally —
 * this middleware adds the additional gate of requiring 'approved'.
 */
function requireApprovedAccount(req, _res, next) {
  if (!req.user) return next(new AppError("Not authenticated", 401));

  // Admins bypass the approval gate.
  if (req.user.role === "admin") return next();

  if (req.user.account_status !== "approved") {
    const reasons = {
      pending: "حسابك قيد المراجعة من قِبل الإدارة. يمكنك التصفح والشراء، أما البيع/التأجير/قبول طلبات التوصيل فيُفعَّل بعد الموافقة.",
      rejected: "تم رفض تفعيل صلاحيات هذا الحساب. تواصل مع الإدارة لإعادة المراجعة.",
    };
    const msg =
      reasons[req.user.account_status] ||
      "Account is not approved for this action.";
    return next(new AppError(msg, 403));
  }

  return next();
}

module.exports = requireApprovedAccount;
