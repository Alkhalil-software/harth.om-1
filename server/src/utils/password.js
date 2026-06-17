const bcrypt = require("bcrypt");
const env = require("../config/env");

function hashPassword(password) {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, verifyPassword };
