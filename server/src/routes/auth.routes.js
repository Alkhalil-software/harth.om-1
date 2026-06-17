const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/auth.controller");
const {
  checkEmailValidator,
  loginValidator,
  registerValidator,
  verifyEmailValidator,
  requestPasswordResetValidator,
  resetPasswordValidator,
  changePasswordValidator,
} = require("../validators/auth.validator");
const auth = require("../middleware/auth");

// OTP endpoints get an extra-tight rate limit on top of the global /auth one.
// The point is to prevent a single email/IP from triggering hundreds of OTP
// emails in a row (cost + spam-filter risk). Verifying codes is also limited
// so brute-forcing the 6-digit space is impractical even with the per-row
// attempt cap as an additional layer of defence.
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 429, message: "Too many OTP requests" } },
});

// POST /api/v1/auth/check-email
router.post("/check-email", checkEmailValidator, authController.checkEmail);

// POST /api/v1/auth/register
router.post("/register", registerValidator, authController.register);

// POST /api/v1/auth/login
router.post("/login", loginValidator, authController.login);

// GET /api/v1/auth/me - protected
router.get("/me", auth, authController.me);

// POST /api/v1/auth/logout - protected (client-side)
router.post("/logout", auth, authController.logout);

// ─── Email verification ────────────────────────────────────────────────
// POST /auth/verify-email/send - resend the verification OTP (authenticated)
router.post(
  "/verify-email/send",
  otpLimiter,
  auth,
  authController.sendEmailVerificationOtp,
);
// POST /auth/verify-email - submit the OTP and flip email_verified=true
router.post(
  "/verify-email",
  otpLimiter,
  auth,
  verifyEmailValidator,
  authController.verifyEmail,
);

// Password reset via email removed — feature disabled.

// ─── Password change (authenticated) ──────────────────────────────────
// POST /auth/password/request-change - send change-confirmation OTP
router.post(
  "/password/request-change",
  otpLimiter,
  auth,
  authController.requestPasswordChange,
);
// POST /auth/password/change - verify OTP + current pw + set new pw
router.post(
  "/password/change",
  otpLimiter,
  auth,
  changePasswordValidator,
  authController.changePassword,
);

module.exports = router;
