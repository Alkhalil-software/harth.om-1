const jwt = require("jsonwebtoken");
const env = require("../config/env");

/**
 * Sign a JWT for a user. We only put identifiers in the payload — never PII.
 */
function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

/**
 * Verify a token. Throws jsonwebtoken errors on failure; caller should catch.
 */
function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
